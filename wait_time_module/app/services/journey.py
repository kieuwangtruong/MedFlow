from datetime import datetime,timedelta

def estimate_journey(checkin:datetime,ewt_a1:float,service_a1:float,walk_ab:float,ewt_b:float,service_b:float,walk_ba:float,result_turnaround:float,next_slot_a:datetime,review_duration:float,schedule_window_start:datetime|None=None):
    completion_a1=checkin+timedelta(minutes=ewt_a1+service_a1)
    completion_b=completion_a1+timedelta(minutes=walk_ab+ewt_b+service_b)
    physical=completion_b+timedelta(minutes=walk_ba); result=completion_b+timedelta(minutes=result_turnaround)
    ready=max(physical,result); release=max(ready,schedule_window_start) if schedule_window_start else ready
    start=max(release,next_slot_a); completion=start+timedelta(minutes=review_duration)
    return {"initial_consult_completion":completion_a1,"diagnostic_completion":completion_b,"physical_return":physical,"result_ready":result,"ready_for_review":ready,"review_start":start,"return_ewt_minutes":max(0,(start-ready).total_seconds()/60),"journey_completion":completion,"journey_minutes":(completion-checkin).total_seconds()/60}

