# Hạn chế

- Model và distribution mặc định dựa trên synthetic assumptions, chưa calibration hoặc clinical validation.
- SQLite chỉ dành cho local/demo một worker; không phù hợp ghi đồng thời nhiều instance.
- PostgreSQL URL được hỗ trợ qua SQLAlchemy nhưng repository không triển khai hạ tầng DB/driver/migration server.
- API key là service authentication tối thiểu, chưa có key rotation service hoặc OIDC/JWKS.
- Monte Carlo mô hình các nguồn bất định độc lập có cấu hình; correlation lâm sàng thực phải học từ dữ liệu bệnh viện.
- Cache nằm trong process; deployment nhiều worker nên dùng shared cache hoặc đọc snapshot đã tính từ DB.
- Assignment impact là mô phỏng scheduler trên snapshot hiện tại, không phải cam kết SLA.
- Không lưu PII và không dùng `patient_token` làm authorization.
- Migration schema 2 là script JSON-snapshot idempotent cho local, không phải Alembic production migration.
- Module không xác định hai dịch vụ có thể song song và không tính transfer time; Routing Agent phải cung cấp.
- Arrival/other-service distributions là synthetic assumptions, chưa học correlation từ dữ liệu thật.
- Vòng này chỉ test SQLite local một Uvicorn worker; không test cloud, Redis, Docker/Kubernetes hoặc PostgreSQL server.
