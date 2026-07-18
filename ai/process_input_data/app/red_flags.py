from __future__ import annotations

from dataclasses import asdict, dataclass

from .preprocessing import remove_diacritics


@dataclass(frozen=True)
class RedFlagMatch:
    code: str
    label: str
    matched_terms: list[str]
    priority: str = "EMERGENCY"
    target_department: str = "ER"
    requires_human_review: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


NEGATIONS = ("khong", "chua", "khong bi", "khong co")
RULES: tuple[tuple[str, str, tuple[tuple[str, ...], ...]], ...] = (
    ("CHEST_PAIN_WITH_DYSPNEA", "Đau ngực kèm khó thở", (("dau nguc", "kho tho"), ("tuc nguc", "kho tho"), ("tuc nguc", "hut hoi"))),
    ("SUDDEN_NEURO_DEFICIT", "Dấu hiệu thần kinh xuất hiện đột ngột", (("meo mieng", "yeu tay"), ("noi kho", "yeu tay"), ("liet", "dot ngot"), ("yeu mot ben", "noi kho"), ("noi ngong", "khong nang duoc tay"))),
    ("LOSS_OF_CONSCIOUSNESS", "Mất ý thức hoặc bất tỉnh", (("bat tinh",), ("mat y thuc",), ("ngat lau",), ("ngat", "kho danh thuc"))),
    ("SEIZURE_ACTIVE", "Co giật", (("co giat",), ("giat toan than",))),
    ("SEVERE_BLEEDING", "Chảy máu nghiêm trọng", (("chay mau nhieu",), ("mau chay lien tuc",), ("chay mau", "choang"), ("chay mau", "uot nhieu gac"))),
    ("SEVERE_BREATHING_DIFFICULTY", "Khó thở nghiêm trọng", (("kho tho nghiem trong",), ("khong noi duoc cau dai",), ("tim tai", "kho tho"), ("tho gap", "tim moi"), ("khong the nam", "kho tho"))),
    ("ANAPHYLAXIS_SIGNS", "Nghi phản vệ", (("mat sung", "kho khe"), ("phu mat", "kho tho"), ("phat ban", "kho tho"), ("sung moi", "kho tho"), ("sung luoi", "hut hoi"), ("noi man", "kho tho"))),
    ("ACUTE_VISION_LOSS", "Giảm hoặc mất thị lực cấp", (("mat thi luc",), ("nhin mo nhanh",), ("mat toi sam",), ("khong nhin ro mot mat",))),
    ("PREGNANCY_HEAVY_BLEEDING", "Thai kỳ kèm chảy máu", (("mang thai", "chay mau am dao"), ("thai phu", "chay mau"), ("mang thai", "ra mau nhieu"), ("mang thai", "ra huyet do nhieu"))),
    ("SEVERE_TRAUMA", "Chấn thương nghiêm trọng", (("nga cao",), ("tai nan", "khong cu dong"), ("chan thuong nang",), ("chan thuong manh", "vung dau"), ("tai nan giao thong", "lo mo"))),
)


def _is_negated(text: str, term: str) -> bool:
    position = text.find(term)
    if position < 0:
        return False
    prefix = text[max(0, position - 18):position].strip()
    return any(negation in prefix for negation in NEGATIONS)


def detect_red_flag(text: str, pregnancy_status: str = "NA") -> RedFlagMatch | None:
    normalized = remove_diacritics(text)
    if str(pregnancy_status).upper() == "YES":
        normalized = f"thai phu mang thai {normalized}"

    for code, label, alternatives in RULES:
        for required_terms in alternatives:
            if all(term in normalized and not _is_negated(normalized, term) for term in required_terms):
                return RedFlagMatch(code=code, label=label, matched_terms=list(required_terms))
    return None
