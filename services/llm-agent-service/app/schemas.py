from pydantic import BaseModel


class ReviewRequest(BaseModel):
    file_path: str
    hunk_text: str
    risk_score: float


class ReviewResponse(BaseModel):
    summary: str
    suggestion: str
    severity: str
