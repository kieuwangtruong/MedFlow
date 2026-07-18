from __future__ import annotations

import json
import gc
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score, log_loss
from sklearn.pipeline import FeatureUnion, Pipeline

from process_input_data.app.preprocessing import model_text
from process_input_data.app.red_flags import detect_red_flag


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "unified_symptom_routing.csv"
RED_FLAG_PATH = ROOT / "data" / "red_flag_cases.csv"
DEPARTMENTS_PATH = ROOT / "data" / "departments.csv"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
MODEL_PATH = MODELS_DIR / "clinic_room_router.joblib"
METADATA_PATH = MODELS_DIR / "model_metadata.json"
REPORT_PATH = REPORTS_DIR / "evaluation.json"


def build_pipeline() -> Pipeline:
    features = FeatureUnion(
        [
            (
                "word_tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_df=0.98,
                    sublinear_tf=True,
                    max_features=8_000,
                ),
            ),
            (
                "char_tfidf",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(3, 4),
                    min_df=2,
                    sublinear_tf=True,
                    max_features=12_000,
                ),
            ),
        ]
    )
    classifier = SGDClassifier(
        loss="log_loss",
        alpha=1e-5,
        max_iter=1_000,
        class_weight="balanced",
        tol=1e-3,
        random_state=20260718,
    )
    return Pipeline([("features", features), ("classifier", classifier)])


def top_k_accuracy(y_true: np.ndarray, probabilities: np.ndarray, classes: np.ndarray, k: int) -> float:
    top_indices = np.argsort(probabilities, axis=1)[:, -k:]
    correct = [truth in classes[indices] for truth, indices in zip(y_true, top_indices)]
    return float(np.mean(correct))


def evaluate(pipeline: Pipeline, frame: pd.DataFrame) -> dict:
    texts = frame["patient_text"].map(model_text)
    labels = frame["clinic_room"].to_numpy()
    predictions = pipeline.predict(texts)
    probabilities = pipeline.predict_proba(texts)
    classes = pipeline.classes_
    return {
        "rows": len(frame),
        "accuracy_top_1": round(float(accuracy_score(labels, predictions)), 4),
        "accuracy_top_2": round(top_k_accuracy(labels, probabilities, classes, 2), 4),
        "accuracy_top_3": round(top_k_accuracy(labels, probabilities, classes, 3), 4),
        "macro_f1": round(float(f1_score(labels, predictions, average="macro")), 4),
        "weighted_f1": round(float(f1_score(labels, predictions, average="weighted")), 4),
        "log_loss": round(float(log_loss(labels, probabilities, labels=classes)), 4),
        "mean_top_confidence": round(float(np.max(probabilities, axis=1).mean()), 4),
        "classification_report": classification_report(
            labels,
            predictions,
            output_dict=True,
            zero_division=0,
        ),
    }


def evaluate_red_flags() -> dict:
    frame = pd.read_csv(RED_FLAG_PATH, encoding="utf-8-sig")
    expected = frame["is_red_flag"].astype(str).str.lower().eq("true").to_numpy()
    predicted = np.array(
        [
            detect_red_flag(row.patient_text, row.pregnancy_status) is not None
            for row in frame.itertuples(index=False)
        ]
    )
    true_positive = int(np.sum(expected & predicted))
    false_positive = int(np.sum(~expected & predicted))
    false_negative = int(np.sum(expected & ~predicted))
    true_negative = int(np.sum(~expected & ~predicted))
    precision = true_positive / max(true_positive + false_positive, 1)
    recall = true_positive / max(true_positive + false_negative, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-12)
    return {
        "rows": len(frame),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "confusion_matrix": {
            "true_negative": true_negative,
            "false_positive": false_positive,
            "false_negative": false_negative,
            "true_positive": true_positive,
        },
    }


def main() -> None:
    MODELS_DIR.mkdir(exist_ok=True)
    REPORTS_DIR.mkdir(exist_ok=True)

    frame = pd.read_csv(DATA_PATH, encoding="utf-8-sig")
    required = {"symptom_input", "clinic_room", "department_code", "split"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Dataset thiếu cột: {', '.join(sorted(missing))}")
    frame = frame.rename(columns={"symptom_input": "patient_text"})

    train = frame[frame["split"] == "train"].copy()
    validation = frame[frame["split"] == "validation"].copy()
    test = frame[frame["split"] == "test"].copy()

    validation_model = build_pipeline()
    validation_model.fit(
        train["patient_text"].map(model_text),
        train["clinic_room"],
    )
    validation_metrics = evaluate(validation_model, validation)
    del validation_model
    gc.collect()

    final_training = pd.concat([train, validation], ignore_index=True)
    final_model = build_pipeline()
    final_model.fit(
        final_training["patient_text"].map(model_text),
        final_training["clinic_room"],
    )
    test_metrics = evaluate(final_model, test)
    red_flag_metrics = evaluate_red_flags()

    joblib.dump(final_model, MODEL_PATH, compress=3)

    departments = pd.read_csv(DEPARTMENTS_PATH, encoding="utf-8-sig")
    department_names = dict(
        zip(departments["department_code"], departments["department_name"])
    )
    clinic_departments = (
        frame[["clinic_room", "department_code"]]
        .drop_duplicates()
        .set_index("clinic_room")["department_code"]
        .to_dict()
    )
    metadata = {
        "algorithm": "FeatureUnion(TF-IDF word + TF-IDF char) + SGD logistic regression",
        "task": "clinic_room_routing_not_medical_diagnosis",
        "language": "vi",
        "classes": final_model.classes_.tolist(),
        "department_names": department_names,
        "clinic_departments": clinic_departments,
        "data_path": DATA_PATH.relative_to(ROOT).as_posix(),
        "data_rows": len(frame),
        "training_rows": len(final_training),
        "test_rows": len(test),
        "split": {"train": len(train), "validation": len(validation), "test": len(test)},
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
        "red_flag_metrics": red_flag_metrics,
        "scikit_learn_version": sklearn.__version__,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data_notice": "Synthetic and unvalidated; not for autonomous clinical decisions.",
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REPORT_PATH.write_text(
        json.dumps(
            {
                "validation": validation_metrics,
                "test": test_metrics,
                "red_flags": red_flag_metrics,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    print(f"Model: {MODEL_PATH}")
    print(f"Metadata: {METADATA_PATH}")
    print(json.dumps({"test": test_metrics, "red_flags": red_flag_metrics}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
