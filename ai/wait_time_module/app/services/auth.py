import json, os
from dataclasses import dataclass
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

header=APIKeyHeader(name="X-API-Key",auto_error=False)
@dataclass
class Principal: actor_id:str;actor_type:str;scopes:set[str]

def require_scope(scope:str):
    def dependency(api_key:str|None=Security(header)):
        if os.getenv("AUTH_ENABLED","false").lower() not in {"1","true","yes"}:return Principal("development","SERVICE",{"wait.read","events.write","simulation.run","admin.manage"})
        if not api_key:raise HTTPException(401,"UNAUTHORIZED")
        try:record=json.loads(os.getenv("SERVICE_API_KEYS","{}"))[api_key]
        except (KeyError,ValueError,TypeError):raise HTTPException(401,"UNAUTHORIZED")
        principal=Principal(record.get("actor_id","unknown"),record.get("actor_type","SERVICE"),set(record.get("scopes",[])))
        if scope not in principal.scopes and "admin.manage" not in principal.scopes:raise HTTPException(403,"FORBIDDEN")
        return principal
    return dependency
