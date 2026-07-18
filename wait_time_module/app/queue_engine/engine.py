from __future__ import annotations
import heapq, os, random
from datetime import datetime, timedelta
from app.domain.models import *

PRIORITY={ClinicalPriority.EMERGENCY:0,ClinicalPriority.URGENT:1,ClinicalPriority.NORMAL:2}
ELIGIBLE={ReadinessStatus.WAITING,ReadinessStatus.READY,ReadinessStatus.ARRIVED,ReadinessStatus.RETURNING}
TERMINAL={ReadinessStatus.COMPLETED,ReadinessStatus.NO_SHOW_HOLD,ReadinessStatus.CANCELLED}
HARD_PRESENCE={PresenceStatus.READY_AT_ROOM,PresenceStatus.ARRIVED_AT_ROOM}
def round5(v:float)->int:return max(0,int(5*round(v/5)))

class QueueEngine:
    def hard_eligible(self,t:Task,tasks:list[Task],now:datetime)->bool:
        by_id={x.task_id:x for x in tasks};dependencies=all(by_id.get(i) and by_id[i].readiness_status==ReadinessStatus.COMPLETED for i in t.dependency_task_ids)
        return t.readiness_status in ELIGIBLE and t.presence_status in HARD_PRESENCE and dependencies and (t.eligible_at or t.ready_at)<=now and t.ready_at<=now and (not t.schedule_window_start or t.schedule_window_start<=now)
    def order(self,tasks:list[Task],now:datetime,include_future:bool=False)->list[Task]:
        if include_future:
            eligible=[t for t in tasks if t.readiness_status not in TERMINAL|{ReadinessStatus.IN_SERVICE} and t.presence_status!=PresenceStatus.LEFT_HOSPITAL]
        else:eligible=[t for t in tasks if self.hard_eligible(t,tasks,now)]
        def key(t):
            wait=max(0,(now-t.ready_at).total_seconds()/60);sla_risk=t.task_type==TaskType.RETURN_REVIEW and wait>=.8*t.return_review_sla_minutes
            return (PRIORITY[t.clinical_priority],0 if sla_risk else 1,t.ready_at,t.created_seq)
        return sorted(eligible,key=key)
    def schedule(self,tasks:list[Task],resources:list[Resource],now:datetime,duration_factor:float=1.0,include_future:bool=False)->dict[str,float]:
        active=[r for r in resources if r.status!=ResourceStatus.FAILED]
        if not active:return {}
        heap=[(r.busy_minutes,i,r) for i,r in enumerate(active)];heapq.heapify(heap);starts={}
        for task in self.order(tasks,now,include_future):
            compatible=[x for x in heap if not x[2].compatible_service_types or task.service_type in x[2].compatible_service_types]
            if not compatible:continue
            chosen=min(compatible);heap.remove(chosen);heapq.heapify(heap);free,i,res=chosen
            release=max(0,(task.ready_at-now).total_seconds()/60)
            if task.eligible_at:release=max(release,(task.eligible_at-now).total_seconds()/60)
            if task.predicted_available_at:release=max(release,(task.predicted_available_at-now).total_seconds()/60)
            if task.schedule_window_start:release=max(release,(task.schedule_window_start-now).total_seconds()/60)
            start=max(free,release);starts[task.task_id]=start;heapq.heappush(heap,(start+task.predicted_minutes*duration_factor,i,res))
        return starts
    def monte_carlo(self,target:Task,tasks:list[Task],resources:list[Resource],now:datetime,runs:int|None=None,seed:int=42):
        if not any(r.status!=ResourceStatus.FAILED for r in resources):return None
        runs=runs or int(os.getenv("MONTE_CARLO_RUNS","300"));service_sigma=float(os.getenv("MONTE_CARLO_SERVICE_SIGMA","0.20"));result_sigma=float(os.getenv("MONTE_CARLO_RESULT_SIGMA","0.30"));review_sigma=float(os.getenv("MONTE_CARLO_REVIEW_SIGMA","0.20"));arrival_sigma=float(os.getenv("MONTE_CARLO_ARRIVAL_SIGMA","0.20"));other_sigma=float(os.getenv("MONTE_CARLO_OTHER_SERVICE_SIGMA","0.25"));future_probability=float(os.getenv("MONTE_CARLO_FUTURE_READY_PROBABILITY","0.90"));emergency_p=float(os.getenv("MONTE_CARLO_EMERGENCY_PROBABILITY","0.02"));emergency_mean=float(os.getenv("MONTE_CARLO_EMERGENCY_MEAN_MINUTES","12"))
        rng=random.Random(seed);values=[]
        for _ in range(runs):
            sampled=[]
            for t in tasks:
                if t.readiness_status==ReadinessStatus.RESULT_PENDING:
                    base_ready=t.estimated_result_ready_at or now+timedelta(minutes=10);return_ready=t.estimated_return_arrived_at or base_ready
                    result_delay=max(.1,(base_ready-now).total_seconds()/60)*rng.lognormvariate(-.5*result_sigma**2,result_sigma)
                    ready=max(now+timedelta(minutes=result_delay),return_ready)
                    sampled.append(t.model_copy(update={"task_type":TaskType.RETURN_REVIEW,"service_type":"RESULT_REVIEW","readiness_status":ReadinessStatus.READY,"presence_status":PresenceStatus.READY_AT_ROOM,"ready_at":ready,"eligible_at":ready,"predicted_minutes":max(.1,5*rng.lognormvariate(-.5*review_sigma**2,review_sigma))}))
                elif not self.hard_eligible(t,tasks,now):
                    base=t.predicted_available_at or t.eligible_at or t.ready_at;delta=max(.1,(base-now).total_seconds()/60);sigma=other_sigma if t.presence_status==PresenceStatus.IN_OTHER_SERVICE else arrival_sigma;sampled_ready=now+timedelta(minutes=delta*rng.lognormvariate(-.5*sigma**2,sigma))
                    if rng.random()>future_probability:sampled_ready+=timedelta(minutes=60)
                    sampled.append(t.model_copy(update={"readiness_status":ReadinessStatus.READY,"presence_status":PresenceStatus.READY_AT_ROOM,"ready_at":sampled_ready,"eligible_at":sampled_ready,"predicted_available_at":None,"predicted_minutes":max(.1,t.predicted_minutes*rng.lognormvariate(-.5*service_sigma**2,service_sigma))}))
                else:sampled.append(t.model_copy(update={"predicted_minutes":max(.1,t.predicted_minutes*rng.lognormvariate(-.5*service_sigma**2,service_sigma))}))
            sampled_resources=[r.model_copy(update={"busy_minutes":r.busy_minutes+(rng.expovariate(1/emergency_mean) if rng.random()<emergency_p else 0)}) for r in resources]
            starts=self.schedule(sampled,sampled_resources,now,include_future=True);values.append(starts.get(target.task_id,0))
        values.sort();pct=lambda p:values[min(len(values)-1,int(p*(len(values)-1)))];p50,p80,p90=pct(.5),pct(.8),pct(.9)
        return {"ewt_p50_minutes":round5(p50),"ewt_p80_minutes":round5(p80),"ewt_p90_minutes":round5(p90),"display_min_minutes":round5(p50),"display_max_minutes":round5(p80)}
