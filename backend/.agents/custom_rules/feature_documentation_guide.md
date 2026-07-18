# Feature Documentation Guide

## Mục đích
File này quy định cách viết tài liệu feature trong repository.
Mục tiêu là để mỗi feature có đúng một tài liệu, dễ tra cứu, dễ bảo trì, và đủ ngữ cảnh để người đọc hiểu feature mà không phải mở nhiều file.

## Nguyên tắc chính
Áp dụng quy tắc:

- `1 feature = 1 document`

Không tách tài liệu theo route.
Không tạo một thư mục riêng chứa nhiều file tài liệu cho cùng một feature.

## Vị trí lưu trữ
Mỗi feature phải có một file Markdown đặt trong thư mục `docs/internal/`.

Ví dụ:

- `docs/internal/auth.md`
- `docs/internal/booking.md`
- `docs/internal/payment.md`
- `docs/internal/chat.md`
- `docs/internal/notification.md`
- `docs/internal/venue-management.md`
- `docs/internal/matchmaking.md`

## Quy tắc đặt tên
- Tên file dùng `kebab-case`.
- Tên file phải phản ánh đúng tên feature.
- Không thêm tiền tố method như `get_`, `post_`, `put_`.
- Không dùng dấu cách hoặc ký tự đặc biệt trong tên file.

Ví dụ:

- `booking.md`
- `payment.md`
- `venue-management.md`

## Nội dung bắt buộc cho mỗi document
Mỗi file tài liệu của feature phải chứa đầy đủ các phần sau:

1. `Overview`
2. `Functional Requirements`
3. `Use Cases`
4. `Flow text`
5. `Sequence text`
6. `API contracts`
7. `Data model`
8. `Edge cases`

Có thể thêm các phần khác nếu cần, nhưng không được thiếu các phần bắt buộc ở trên.
Ví dụ các phần bổ sung hợp lệ:

- `States`
- `Notes`
- `Assumptions`
- `Dependencies`

## Ý nghĩa của từng phần
### `Overview`
Giải thích feature này dùng để làm gì, phục vụ ai, và phạm vi của tài liệu.

### `Functional Requirements`
Liệt kê các yêu cầu nghiệp vụ chính mà feature phải đáp ứng.
Viết theo hành vi mong đợi của hệ thống, không viết mơ hồ.

### `Use Cases`
Liệt kê các tình huống sử dụng chính của feature.
Mỗi use case nên ngắn, rõ, và có tên theo hành động.

### `Flow text`
Mô tả luồng xử lý bằng văn bản.
Nếu feature có nhiều luồng, tách thành nhiều mục con như:

- `Flow: Create Hold Booking`
- `Flow: Payment Success Webhook`

### `Sequence text`
Mô tả tuần tự tương tác giữa actor, service, database, webhook, hoặc hệ thống ngoài bằng text.
Không cần vẽ sequence diagram.
Nếu feature có nhiều luồng, mỗi luồng nên có một phần sequence text riêng.

### `API contracts`
Mô tả các API liên quan đến feature, bao gồm:

- Method
- Path
- Headers quan trọng
- Params
- Query
- Body
- Response success
- Response error

Nếu feature không phải API-first, vẫn cần ghi rõ contract giữa các thành phần liên quan, ví dụ webhook payload, event payload, hoặc internal service contract.

### `Data model`
Mô tả các entity, field quan trọng, trạng thái, ràng buộc, và quan hệ dữ liệu liên quan đến feature.

### `Edge cases`
Liệt kê các trường hợp đặc biệt, lỗi nghiệp vụ, race condition, dữ liệu thiếu, trạng thái không hợp lệ, hoặc hành vi fallback.

## Khi viết tài liệu cho feature mới
Thực hiện theo các bước sau:

1. Xác định tên feature.
2. Tạo một file tại `docs/internal/<feature-name>.md`.
3. Gom toàn bộ nội dung của feature vào đúng file đó.
4. Điền đầy đủ các phần bắt buộc.
5. Nếu feature có nhiều flow hoặc nhiều API, vẫn giữ trong cùng một document và chia thành các mục con rõ ràng.

## Ví dụ cấu trúc thư mục
```text
docs/
├── project_structure.md
├── external/
│   ├── better_auth/
│   └── prisma/
└── internal/
    ├── auth.md
    ├── booking.md
    ├── payment.md
    ├── chat.md
    ├── notification.md
    ├── venue-management.md
    └── matchmaking.md
```

## Ví dụ cấu trúc cho `docs/internal/booking.md`
```markdown
# Booking Module

## Overview

## Functional Requirements

## Booking States

## Use Cases
- Create hold booking
- Confirm booking
- Expire booking
- Refund booking

## Flow: Create Hold Booking

## Sequence Text: Hold Booking

## Flow: Payment Success Webhook

## Sequence Text: Payment Confirmation

## API Contracts

## Data Model

## Edge Cases

## Notes
```

## Skill bắt buộc khi viết tài liệu
Khi viết hoặc sửa tài liệu feature, phải dùng skill `writing-clearly-and-concisely` từ file `.agents/skills/writing-clearly-and-concisely/SKILL.md`.

Skill này giúp tài liệu:

- Rõ ràng và trực tiếp
- Dùng câu chủ động
- Tránh dài dòng
- Dùng từ ngữ cụ thể
- Tránh văn phong chung chung kiểu AI

## Quy tắc viết
- Viết ngắn, rõ, và bám sát code hiện tại.
- Một đoạn chỉ nên nói một ý chính.
- Ưu tiên động từ rõ nghĩa như `create`, `confirm`, `expire`, `refund`, `validate`, `persist`.
- Mọi flow, contract, và edge case phải phản ánh đúng hành vi đang có trong code.
- Nếu có giả định hoặc giới hạn chưa được code xử lý rõ, ghi riêng trong `Notes` hoặc `Assumptions`.

## Không làm
- Không tạo nhiều file cho một feature.
- Không tách tài liệu theo từng route.
- Không mô tả chung chung mà thiếu flow, sequence text, hoặc contract cụ thể.
- Không viết tài liệu trái với hành vi hiện tại của code.
