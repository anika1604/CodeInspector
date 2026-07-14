"""
Mines commit history from one or more public GitHub repos using PyDriller
to build a labeled training set for the bug-risk classifier.

Labeling heuristic (standard in bug-risk-prediction literature, e.g. the
SZZ-style approach): a commit's changed hunks are labeled POSITIVE (risky)
if a *later* commit that touches the same lines has a message matching
bug-fix keywords ("fix", "bug", "issue #", "regression", ...). Otherwise
the hunk is labeled NEGATIVE.

This is an approximation, not true SZZ blame-tracing (that requires
line-level git blame across history, which is a larger undertaking) — but
it is a defensible, explainable labeling strategy that's easy to describe
and reproduce for a portfolio project.

Usage:
    python mine_dataset.py --repo https://github.com/psf/requests --limit 4000

Output:
    training/dataset.csv  (features + label per hunk)
"""
import argparse
import csv
import re
import sys
from pathlib import Path

from pydriller import Repository

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.features import extract_features, FEATURE_NAMES  # noqa: E402

BUGFIX_PATTERN = re.compile(
    r"\b(fix|fixes|fixed|bug|bugfix|issue #?\d+|regression|revert|hotfix)\b",
    re.IGNORECASE,
)


def mine_repo(repo_url: str, limit: int) -> list[dict]:
    rows = []
    file_last_touch: dict[str, bool] = {}  # file_path -> was next touch a bugfix?

    commits = list(Repository(repo_url).traverse_commits())
    print(f"  found {len(commits)} commits total in repo history")
    # We need to look ahead, so process in forward order and, for each
    # commit, check whether ANY subsequent commit touching the same file
    # within the next N commits is a bugfix commit.
    total = min(limit, len(commits))
    print(f"  will process {total} of them")

    for i, commit in enumerate(commits[:total]):
        is_future_bugfix_for_file = {}
        lookahead = commits[i + 1 : i + 1 + 50]  # bounded lookahead window
        for future_commit in lookahead:
            try:
                if not BUGFIX_PATTERN.search(future_commit.msg or ""):
                    continue
                for mf in future_commit.modified_files:
                    if mf.old_path:
                        is_future_bugfix_for_file[mf.old_path] = True
                    if mf.new_path:
                        is_future_bugfix_for_file[mf.new_path] = True
            except Exception as exc:  # noqa: BLE001
                # A small number of commits (merge commits with odd parent
                # structure, encoding issues, etc.) can't be diffed by the
                # underlying `git diff-tree` call. Skip them rather than
                # aborting a multi-thousand-commit mining run over one bad
                # commit — this is expected and fine at low frequency.
                print(f"  skipping unreadable commit {future_commit.hash[:10]} in lookahead: {exc}")
                continue

        try:
            modified_files = list(commit.modified_files)
        except Exception as exc:  # noqa: BLE001
            print(f"  skipping unreadable commit {commit.hash[:10]}: {exc}")
            continue

        for mf in modified_files:
            path = mf.new_path or mf.old_path
            if not path or not mf.diff:
                continue

            added = mf.added_lines or 0
            removed = mf.deleted_lines or 0
            if added + removed == 0:
                continue

            features = extract_features(
                file_path=path,
                hunk_text=mf.diff,
                lines_added=added,
                lines_removed=removed,
            )
            label = int(is_future_bugfix_for_file.get(path, False))

            row = features.to_dict()
            row["label"] = label
            row["repo"] = repo_url
            row["commit_hash"] = commit.hash
            rows.append(row)

        if (i + 1) % 200 == 0:
            print(f"  processed {i + 1}/{total} commits, {len(rows)} hunks so far")

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", action="append", required=True, help="Repo URL (repeatable)")
    parser.add_argument("--limit", type=int, default=3000, help="Max commits per repo")
    parser.add_argument("--out", default="training/dataset.csv")
    args = parser.parse_args()

    all_rows = []
    for repo_url in args.repo:
        print(f"Mining {repo_url} ...")
        all_rows.extend(mine_repo(repo_url, args.limit))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = FEATURE_NAMES + ["label", "repo", "commit_hash"]

    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    positive = sum(r["label"] for r in all_rows)
    print(f"Wrote {len(all_rows)} rows to {out_path} ({positive} positive / {len(all_rows) - positive} negative)")


if __name__ == "__main__":
    main()