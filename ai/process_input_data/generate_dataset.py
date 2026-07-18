from __future__ import annotations

import random
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "unified_symptom_routing.csv"
TARGET_ROWS = 5_000
VARIANTS_PER_CASE = 5
SEED = 20260718

DURATIONS = [
    ("vài giờ", "HOURS"),
    ("từ sáng nay", "TODAY"),
    ("khoảng 2 ngày", "2_DAYS"),
    ("3 đến 5 ngày", "3_5_DAYS"),
    ("gần một tuần", "1_WEEK"),
    ("hơn hai tuần", "OVER_2_WEEKS"),
]
ONSETS = [
    ("xuất hiện đột ngột", "SUDDEN"),
    ("khởi phát từ từ", "GRADUAL"),
    ("tái diễn từng đợt", "RECURRENT"),
    ("liên tục và chưa giảm", "CONTINUOUS"),
]
HISTORIES = [
    ("không ghi nhận bệnh nền đáng chú ý", "NONE_REPORTED"),
    ("có tiền sử tăng huyết áp", "HYPERTENSION"),
    ("có tiền sử đái tháo đường", "DIABETES"),
    ("có cơ địa dị ứng", "ALLERGY"),
    ("đang dùng thuốc điều trị hằng ngày nhưng chưa rõ tên", "DAILY_MEDICATION"),
]
NEGATIVE_CONTEXT = [
    "chưa tự dùng thuốc cho đợt này",
    "chưa đi khám ở cơ sở khác",
    "không nhớ có tiếp xúc với người mắc bệnh tương tự",
    "triệu chứng ảnh hưởng đến sinh hoạt và giấc ngủ",
    "gia đình đưa đến để được phân luồng khám phù hợp",
]
OPENERS = [
    "Tôi đến khám vì {symptom}",
    "Triệu chứng chính của tôi là {symptom}",
    "Hiện tại tôi gặp tình trạng: {symptom}",
    "Tôi muốn được kiểm tra vì {symptom}",
    "Người bệnh mô tả {symptom}",
]


def severity_for(level: str, rng: random.Random) -> int:
    ranges = {
        "LOW": (1, 3),
        "NORMAL": (3, 6),
        "HIGH": (6, 8),
        "URGENT": (7, 9),
        "EMERGENCY": (9, 10),
    }
    low, high = ranges.get(level, (3, 7))
    return rng.randint(low, high)


def enrich_text(row: pd.Series, variant: int, rng: random.Random) -> tuple[str, dict[str, object]]:
    duration_text, duration_code = DURATIONS[(variant + rng.randrange(len(DURATIONS))) % len(DURATIONS)]
    onset_text, onset_code = ONSETS[(variant + rng.randrange(len(ONSETS))) % len(ONSETS)]
    history_text, history_code = HISTORIES[(variant + rng.randrange(len(HISTORIES))) % len(HISTORIES)]
    severity = severity_for(str(row["danger_level"]), rng)
    context = NEGATIVE_CONTEXT[(variant + rng.randrange(len(NEGATIVE_CONTEXT))) % len(NEGATIVE_CONTEXT)]
    symptom = str(row["symptom_input"]).strip().rstrip(". ")
    opener = OPENERS[variant % len(OPENERS)].format(symptom=symptom)

    age_context = f"Người bệnh {int(row['age'])} tuổi"
    gender = str(row["gender"])
    if gender == "FEMALE" and str(row.get("pregnancy_status", "")).upper() == "YES":
        age_context += ", đang mang thai"
    elif gender == "FEMALE":
        age_context += ", nữ"
    else:
        age_context += ", nam"

    progress = (
        "tình trạng nặng lên nhanh và cần được đánh giá ngay"
        if bool(row["is_emergency"])
        else rng.choice([
            "mức độ gần như không thay đổi",
            "cảm giác khó chịu tăng dần",
            "triệu chứng lúc tăng lúc giảm",
            "nghỉ ngơi chỉ giúp giảm một phần",
        ])
    )
    text = (
        f"{opener}. {age_context}. Tình trạng kéo dài {duration_text}, {onset_text}; "
        f"người bệnh tự đánh giá mức khó chịu {severity}/10. Diễn tiến: {progress}. "
        f"Tiền sử: {history_text}; {context}."
    )
    return text, {
        "duration": duration_code,
        "onset_pattern": onset_code,
        "severity_score": severity,
        "medical_history": history_code,
        "context_note": context,
    }


def main() -> None:
    source = pd.read_csv(DATA_PATH, encoding="utf-8-sig")
    if len(source) == 10_000 and "source_case_id" in source.columns:
        result = source[source["case_id"].str.extract(r"V(\d+)$", expand=False).astype(int) <= VARIANTS_PER_CASE].copy()
        result.to_csv(DATA_PATH, index=False, encoding="utf-8-sig")
        print(f"Đã rút gọn còn {len(result):,} dòng tại {DATA_PATH}")
        print(result["split"].value_counts().to_dict())
        print(f"Số phòng khám: {result['clinic_room'].nunique()}")
        return
    if len(source) != 1_000:
        raise ValueError(
            f"Generator cần file nguồn 1.000 dòng, hiện có {len(source):,}. "
            "Không chạy lại trên file đã mở rộng."
        )

    rng = random.Random(SEED)
    rows: list[dict[str, object]] = []
    for source_index, (_, source_row) in enumerate(source.iterrows(), start=1):
        for variant in range(VARIANTS_PER_CASE):
            row = source_row.to_dict()
            text, extra = enrich_text(source_row, variant, rng)
            row.update(extra)
            row["case_id"] = f"CASE-{source_index:04d}-V{variant + 1:02d}"
            row["symptom_input"] = text
            row["source_case_id"] = str(source_row["case_id"])
            row["augmentation_version"] = "rich-v1"
            rows.append(row)

    result = pd.DataFrame(rows)
    if len(result) != TARGET_ROWS:
        raise AssertionError(f"Sai số dòng: {len(result):,}")
    if result["case_id"].duplicated().any():
        raise AssertionError("case_id bị trùng")
    if result["symptom_input"].duplicated().any():
        raise AssertionError("symptom_input bị trùng")

    result.to_csv(DATA_PATH, index=False, encoding="utf-8-sig")
    print(f"Đã tạo {len(result):,} dòng tại {DATA_PATH}")
    print(result["split"].value_counts().to_dict())
    print(f"Số phòng khám: {result['clinic_room'].nunique()}")


if __name__ == "__main__":
    main()
