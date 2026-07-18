"""Kiểm tra và chuẩn hóa dữ liệu bệnh viện thật theo schema huấn luyện; không chứa PII."""
import argparse
from pathlib import Path
import pandas as pd
from scripts.train_models import FEATURES

TARGET="active_service_duration"
REQUIRED=set(FEATURES+[TARGET,"arrival_time"])
def main():
    p=argparse.ArgumentParser();p.add_argument("--input",required=True);p.add_argument("--output",default="data/real/validated.csv");a=p.parse_args()
    frame=pd.read_csv(a.input);missing=sorted(REQUIRED-set(frame.columns))
    if missing:raise ValueError(f"Thiếu cột bắt buộc: {missing}")
    if frame[TARGET].isna().any() or (frame[TARGET]<0).any():raise ValueError("Target phải đầy đủ và không âm")
    if any(x in frame.columns for x in ["name","full_name","phone","email","national_id"]):raise ValueError("Không được đưa PII vào pipeline huấn luyện")
    out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);frame.to_csv(out,index=False);print(f"Đã kiểm tra {len(frame)} dòng: {out}")
if __name__=="__main__":main()
