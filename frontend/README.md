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

Trang đăng nhập có ba nút truy cập nhanh:

- Bệnh nhân: `patient@demo.vn`
- Bác sĩ: `doctor@demo.vn`
- Quản trị: `admin@demo.vn`
- Mật khẩu chung: `123456`

Mặc định ứng dụng sử dụng mock API nên chạy được khi backend chưa hoàn thành.

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
