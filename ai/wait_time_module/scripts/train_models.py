import argparse,json
from datetime import datetime,timezone
from pathlib import Path
import joblib,pandas as pd,numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error,mean_squared_error,mean_pinball_loss
FEATURES=["service_type","queue_id","doctor_id","device_id","hour","day_of_week","case_complexity","resource_status","arrival_rate_15m","avg_service_30m","recent_emergency_count"]
CAT=FEATURES[:4]+FEATURES[6:8]
def main():
 p=argparse.ArgumentParser();p.add_argument("--input",default="data/sample/synthetic.csv");p.add_argument("--artifacts",default="artifacts");a=p.parse_args();d=pd.read_csv(a.input,parse_dates=["arrival_time"]).sort_values("arrival_time");d["hour"]=d.arrival_time.dt.hour;d["day_of_week"]=d.arrival_time.dt.dayofweek;n=len(d);train,val,test=d.iloc[:int(.7*n)],d.iloc[int(.7*n):int(.85*n)],d.iloc[int(.85*n):];base=train.groupby("service_type").active_service_duration.median().to_dict();models={};metrics={}
 for q in [.5,.8,.9]:
  pre=ColumnTransformer([("cat",OneHotEncoder(handle_unknown="ignore",sparse_output=False),CAT)],remainder="passthrough");m=make_pipeline(pre,GradientBoostingRegressor(loss="quantile",alpha=q,random_state=42));m.fit(train[FEATURES],train.active_service_duration);pred=m.predict(test[FEATURES]);models[f"p{int(q*100)}"]=m;metrics[f"p{int(q*100)}"]={"mae":mean_absolute_error(test.active_service_duration,pred),"rmse":mean_squared_error(test.active_service_duration,pred)**.5,"p90_absolute_error":float(np.quantile(abs(test.active_service_duration-pred),.9)),"quantile_loss":mean_pinball_loss(test.active_service_duration,pred,alpha=q),"coverage":float((test.active_service_duration<=pred).mean())}
 bp=test.service_type.map(base).fillna(train.active_service_duration.median());metrics["baseline"]={"mae":mean_absolute_error(test.active_service_duration,bp),"rmse":mean_squared_error(test.active_service_duration,bp)**.5,"p90_absolute_error":float(np.quantile(abs(test.active_service_duration-bp),.9))}; metrics["model_selected"]=bool(metrics["p50"]["mae"]<metrics["baseline"]["mae"])
 p50=models["p50"].predict(test[FEATURES]);evaluation=test[["service_type","queue_id","clinical_priority","active_service_duration"]].copy();evaluation["prediction"]=p50;evaluation["absolute_error"]=(evaluation.active_service_duration-evaluation.prediction).abs()
 metrics["segments"]={}
 for dimension in ["service_type","queue_id","clinical_priority"]:
  metrics["segments"][dimension]={str(key):{"rows":int(len(group)),"mae":float(group.absolute_error.mean()),"median_absolute_error":float(group.absolute_error.median())} for key,group in evaluation.groupby(dimension)}
 root=Path(a.artifacts);root.mkdir(parents=True,exist_ok=True);joblib.dump(models,root/"quantile_models.joblib");(root/"baseline.json").write_text(json.dumps(base,indent=2));(root/"metrics.json").write_text(json.dumps(metrics,indent=2));(root/"feature_schema.json").write_text(json.dumps({"schema_version":"1","features":FEATURES,"target":"active_service_duration","leakage_excluded":["service_start","service_end","active_service_duration","elapsed_service_duration"]},indent=2));(root/"training_metadata.json").write_text(json.dumps({"model_version":datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),"training_data_type":"SYNTHETIC","trained_at":datetime.now(timezone.utc).isoformat(),"feature_schema_version":"1","split":"time 70/15/15","training_row_count":len(train),"train_rows":len(train),"validation_rows":len(val),"test_rows":len(test),"metrics":{"p50_mae":metrics["p50"]["mae"],"p50_rmse":metrics["p50"]["rmse"],"baseline_mae":metrics["baseline"]["mae"],"p50_coverage":metrics["p50"]["coverage"],"p80_coverage":metrics["p80"]["coverage"],"p90_coverage":metrics["p90"]["coverage"]},"fallback_if_model_load_fails":True,"production_policy":"model" if metrics["model_selected"] else "baseline","clinically_validated":False},indent=2))
if __name__=="__main__":main()
