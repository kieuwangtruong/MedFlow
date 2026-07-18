import argparse
from app.storage.memory import Store
def main():
    p=argparse.ArgumentParser();p.add_argument("--database-url",default=None);a=p.parse_args();s=Store(a.database_url);print(f"Đã khởi tạo database: {s.database_url}")
if __name__=="__main__":main()
