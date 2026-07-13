"""
Feature extraction for the bug-risk classifier.

Features are deliberately cheap to compute at inference time (no external
API calls) so risk scoring can run synchronously on every hunk without
becoming the pipeline bottleneck. Heavier signals (author history, file
churn) are looked up from precomputed tables built during training/mining
rather than recomputed live.
"""
import math
import re
from dataclasses import dataclass, asdict

RISKY_KEYWORDS = [
    "except", "catch", "TODO", "FIXME", "hack", "temp", "workaround",
    "eval(", "exec(", "os.system", "subprocess", "!important",
]

CONTROL_FLOW_TOKENS = ["if ", "else", "for ", "while ", "switch", "case ", "try", "catch"]


@dataclass
class HunkFeatures:
    lines_added: int
    lines_removed: int
    net_lines: int
    churn: int
    file_extension_risk: float
    control_flow_density: float
    risky_keyword_count: int
    max_line_length: int
    avg_line_length: float
    nesting_depth_estimate: int
    is_test_file: int
    comment_ratio: float

    def to_vector(self) -> list[float]:
        return list(asdict(self).values())

    def to_dict(self) -> dict:
        return asdict(self)


# Extensions historically more bug-prone in mined open-source data
# (concurrency/lower-level languages skew higher).
_EXTENSION_RISK = {
    ".c": 0.9, ".cpp": 0.85, ".rs": 0.6, ".go": 0.55,
    ".java": 0.5, ".py": 0.45, ".js": 0.5, ".ts": 0.45,
    ".rb": 0.4, ".css": 0.2, ".md": 0.05, ".json": 0.1, ".yml": 0.15,
}


def _extension(file_path: str) -> str:
    idx = file_path.rfind(".")
    return file_path[idx:] if idx != -1 else ""


def extract_features(file_path: str, hunk_text: str, lines_added: int, lines_removed: int) -> HunkFeatures:
    lines = [l for l in hunk_text.split("\n") if l and not l.startswith("@@")]
    code_lines = [l[1:] for l in lines if l.startswith("+") and not l.startswith("+++")]

    line_lengths = [len(l) for l in code_lines] or [0]
    control_flow_hits = sum(
        1 for l in code_lines for tok in CONTROL_FLOW_TOKENS if tok in l
    )
    risky_hits = sum(1 for l in code_lines for kw in RISKY_KEYWORDS if kw in l)
    comment_lines = sum(1 for l in code_lines if re.match(r"^\s*(#|//|/\*|\*)", l))

    # crude nesting estimate via leading-whitespace depth
    indents = [len(l) - len(l.lstrip(" ")) for l in code_lines if l.strip()]
    nesting_estimate = max(indents) // 4 if indents else 0

    return HunkFeatures(
        lines_added=lines_added,
        lines_removed=lines_removed,
        net_lines=lines_added - lines_removed,
        churn=lines_added + lines_removed,
        file_extension_risk=_EXTENSION_RISK.get(_extension(file_path), 0.35),
        control_flow_density=control_flow_hits / max(len(code_lines), 1),
        risky_keyword_count=risky_hits,
        max_line_length=max(line_lengths),
        avg_line_length=sum(line_lengths) / len(line_lengths),
        nesting_depth_estimate=nesting_estimate,
        is_test_file=int(bool(re.search(r"(test|spec)", file_path, re.IGNORECASE))),
        comment_ratio=comment_lines / max(len(code_lines), 1),
    )


FEATURE_NAMES = list(HunkFeatures.__dataclass_fields__.keys())
