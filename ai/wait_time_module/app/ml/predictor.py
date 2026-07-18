from __future__ import annotations
from pathlib import Path
import os
import json, joblib
import pandas as pd

DEFAULTS={"CLINICAL_CONSULT":12.0,"ABDOMINAL_ULTRASOUND":15.0,"XRAY":8.0,"RESULT_REVIEW":5.0}
class DurationPredictor:
    def __init__(self, artifact_dir: str|Path|None=None):
        self.models={}; self.baselines=DEFAULTS.copy(); self.using_fallback=True; self.load_error=None
        if artifact_dir:
            try:
                root=Path(artifact_dir); loaded=joblib.load(root/"quantile_models.joblib")
                self.baselines.update(json.loads((root/"baseline.json").read_text()))
                metadata=json.loads((root/"training_metadata.json").read_text())
                self.features=json.loads((root/"feature_schema.json").read_text())["features"]
                expected=os.getenv("MODEL_SCHEMA_VERSION","1")
                if str(metadata.get("feature_schema_version"))!=expected: raise ValueError(f"INCOMPATIBLE_FEATURE_SCHEMA: expected {expected}")
                if metadata.get("production_policy")=="model": self.models=loaded; self.using_fallback=False
            except Exception as exc: self.load_error=str(exc)
    def _baseline(self, features): return float(self.baselines.get(features.get("service_type"),12.0))
    def predict_service_duration(self, features):
        if not self.models: return {"p50":self._baseline(features),"p80":self._baseline(features)*1.25,"p90":self._baseline(features)*1.5}
        try:
            row=pd.DataFrame([{name:features.get(name,0) for name in self.features}])
            return {q:max(0.0,float(m.predict(row)[0])) for q,m in self.models.items()}
        except Exception:
            return {"p50":self._baseline(features),"p80":self._baseline(features)*1.25,"p90":self._baseline(features)*1.5}
    def predict_result_turnaround(self, features): return {"p50":10.0,"p80":18.0,"p90":25.0}
    def predict_return_review_duration(self, features): return {"p50":5.0,"p80":7.0,"p90":9.0}
