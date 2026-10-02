# MedFlow Frontend

Frontend điều phối bệnh nhân thông minh cho ba vai trò: bệnh nhân, bác sĩ và quản trị viên.

## Công nghệ

React 19, TypeScript strict, Vite, Tailwind CSS, React Router, TanStack Query, Axios, Zustand, React Hook Form, Zod, Recharts, Lucide React và date-fns.

## Cài đặt và chạy

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Mở `http://localhost:5173`.

## Tài khoản demo

### 1. Cổng bệnh nhân (Mặc định)
- Đăng nhập bằng **Họ và tên** + **Số CCCD** (9–12 chữ số, không cần mật khẩu).
- **CCCD demo có sẵn:** `001204012345` — Nguyễn Văn An
- **Tạo lượt khám mới:** Nhập họ tên bất kỳ cùng số CCCD mới (ví dụ `090000000123`).

### 2. Cổng nhân viên (Bấm "Đăng nhập nhân viên")
Giao diện có sẵn 3 nút chọn nhanh để kiểm thử phân quyền (mật khẩu chung: **`12345678`**):

- **Bác sĩ khám:** `bs.nguyen.minh.khang@vaic.vn` (BS. Nguyễn Minh Khang - Phòng khám Tổng quát 101)
- **Nhân viên tiếp nhận / Điều dưỡng:** `ngan01@gmail.com` (ĐD. Nguyễn Thảo Ngân - Quầy tiếp đón & phân luồng)
- **Quản trị viên:** `adminamind` (Quản trị viên - Trung tâm điều hành)


## Kết nối backend thật

Sửa `.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_USE_MOCK_API=false
```

Toàn bộ request nằm trong `src/api`. Axios tự gắn access token và đăng xuất khi backend trả HTTP 401.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run build
```

## Lưu ý bảo mật

- Không đặt OpenAI API key hoặc secret trong biến môi trường `VITE_*`.
- Frontend chỉ gọi các AI endpoint của backend.
- Mock data chỉ phục vụ trình diễn, không dùng dữ liệu bệnh nhân thật.
- Backend vẫn phải xác thực token và role cho mọi endpoint.
