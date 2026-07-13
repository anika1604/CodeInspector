from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import PredictRequest, PredictResponse
from .features import extract_features
from .model import predict, model_info

app = FastAPI(title="ml-risk-service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", **model_info()}


@app.post("/predict", response_model=PredictResponse)
def predict_risk(req: PredictRequest):
    features = extract_features(
        file_path=req.file_path,
        hunk_text=req.hunk_text,
        lines_added=req.lines_added,
        lines_removed=req.lines_removed,
    )
    score, label = predict(features)
    info = model_info()

    return PredictResponse(
        risk_score=round(score, 4),
        risk_label=label,
        model_version=info["version"],
        features=features.to_dict(),
    )
