from pydantic import BaseModel


class PredictRequest(BaseModel):
    file_path: str
    hunk_text: str
    lines_added: int
    lines_removed: int


class PredictResponse(BaseModel):
    risk_score: float
    risk_label: str
    model_version: str
    features: dict
