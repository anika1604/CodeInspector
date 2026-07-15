import json
import os
import google.generativeai as genai

from .prompts import SYSTEM_PROMPT, build_user_prompt

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

_model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    system_instruction=SYSTEM_PROMPT,
    generation_config={
        "response_mime_type": "application/json",
        # Gemini 2.5-series models do internal "thinking" that counts against
        # max_output_tokens. A low limit here can consume the whole budget on
        # reasoning and leave nothing for the actual JSON output, producing a
        # truncated response like a bare "{". 1024 leaves real headroom.
        "max_output_tokens": 1024,
    },
)


def review_hunk(file_path: str, hunk_text: str, risk_score: float) -> dict:
    user_prompt = build_user_prompt(file_path, hunk_text, risk_score)

    response = _model.generate_content(user_prompt)
    raw_text = response.text

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        finish_reason = None
        try:
            finish_reason = response.candidates[0].finish_reason.name
        except Exception:  # noqa: BLE001
            pass

        # Fail safe rather than crashing the analysis pipeline if the model
        # ever wraps JSON in prose, or gets cut off mid-response (surfaced
        # via finish_reason so this is diagnosable from the UI directly
        # instead of showing an opaque truncated fragment).
        parsed = {
            "summary": f"Review suggestion could not be parsed (finish_reason={finish_reason}).",
            "suggestion": raw_text[:500] or "(empty response)",
            "severity": "info",
        }

    parsed.setdefault("severity", "info")
    if parsed["severity"] not in {"info", "warning", "critical"}:
        parsed["severity"] = "info"

    return parsed
