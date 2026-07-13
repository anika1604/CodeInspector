import json
import os
import google.generativeai as genai

from .prompts import SYSTEM_PROMPT, build_user_prompt

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

_model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    system_instruction=SYSTEM_PROMPT,
    generation_config={
        "response_mime_type": "application/json",
        "max_output_tokens": 400,
    },
)


def review_hunk(file_path: str, hunk_text: str, risk_score: float) -> dict:
    user_prompt = build_user_prompt(file_path, hunk_text, risk_score)

    response = _model.generate_content(user_prompt)
    raw_text = response.text

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        # Fail safe rather than crashing the analysis pipeline if the model
        # ever wraps JSON in prose despite response_mime_type="application/json".
        parsed = {
            "summary": "Review suggestion could not be parsed.",
            "suggestion": raw_text[:500],
            "severity": "info",
        }

    parsed.setdefault("severity", "info")
    if parsed["severity"] not in {"info", "warning", "critical"}:
        parsed["severity"] = "info"

    return parsed
