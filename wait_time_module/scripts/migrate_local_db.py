import argparse,json,os
from app.storage.migrations import migrate
def main():
    p=argparse.ArgumentParser();p.add_argument("--database-url",default=os.getenv("DATABASE_URL","sqlite:///./data/wait_time.db"));a=p.parse_args();print(json.dumps(migrate(a.database_url),indent=2,ensure_ascii=False))
if __name__=="__main__":main()
