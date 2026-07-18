import argparse,os
import httpx
def main():
    p=argparse.ArgumentParser();p.add_argument("--base-url",default="http://127.0.0.1:8000");p.add_argument("--api-key",default=os.getenv("WAIT_TIME_API_KEY"));a=p.parse_args();headers={"X-API-Key":a.api_key} if a.api_key else {}
    with httpx.Client(base_url=a.base_url,headers=headers,timeout=10) as client:
        health=client.get("/health");health.raise_for_status();schema=client.get("/openapi.json");schema.raise_for_status();rooms=client.get("/api/v1/rooms/status");rooms.raise_for_status()
        print({"health":health.json(),"openapi_paths":len(schema.json()["paths"]),"rooms":len(rooms.json())})
if __name__=="__main__":main()
