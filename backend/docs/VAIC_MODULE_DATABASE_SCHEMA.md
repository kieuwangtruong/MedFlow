# VAIC module database schema

Tai lieu nay mo ta y nghia cac bang va cac field dang duoc thiet ke cho cac module:

- Quan ly dang nhap nhan vien.
- Quan ly tra cuu hanh trinh kham cua benh nhan bang ma dinh danh.
- Quan ly hanh trinh kham cua benh nhan.
- Quan ly hang doi theo tung phong kham.
- Xu ly task phu thuoc song song.
- Luu thong ke check-in theo khung gio de du doan gio cao diem.

Ten bang va ten cot trong tai lieu nay dung theo format luu trong database.

## staff_users

Bang luu tai khoan nhan vien noi bo de dang nhap vao he thong quan tri/van hanh.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua tai khoan nhan vien. |
| `username` | Ten dang nhap duy nhat cua nhan vien. |
| `password_hash` | Mat khau da hash, khong luu mat khau goc. |
| `full_name` | Ho ten nhan vien. |
| `role` | Vai tro cua nhan vien, vi du `ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `STAFF`. |
| `status` | Trang thai tai khoan, vi du `ACTIVE`, `INACTIVE`, `LOCKED`. |
| `last_login_at` | Thoi diem dang nhap gan nhat. |
| `created_at` | Thoi diem tao tai khoan. |
| `updated_at` | Thoi diem cap nhat tai khoan gan nhat. |

## patients

Bang luu dinh danh benh nhan de phuc vu luong tra cuu. Benh nhan chi can nhap `identification_code`, he thong tim ra `patient_token`, sau do truy van journey/task tu data seed theo `patient_token`.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua benh nhan trong he thong. |
| `identification_code` | Ma dinh danh benh nhan nhap vao de tra cuu. Co the la CCCD, ma BHYT, ma ho so, hoac ma benh nhan noi bo tuy nghiep vu. |
| `patient_token` | Token dung de map voi `patient_journeys.patient_token` va `patient_journey_tasks.patient_token`. |
| `full_name` | Ho ten benh nhan neu duoc phep luu. |
| `phone_number` | So dien thoai lien he neu can. |
| `date_of_birth` | Ngay sinh, co the dung de xac minh them khi tra cuu. |
| `status` | Trang thai ho so benh nhan, vi du `ACTIVE`, `INACTIVE`, `MERGED`. |
| `created_at` | Thoi diem tao ho so benh nhan. |
| `updated_at` | Thoi diem cap nhat ho so benh nhan gan nhat. |

Quan he chinh:

- `patients.patient_token` la khoa nghiep vu de noi voi journey/task.
- Mot `patients` co nhieu `patient_journeys`.
- Mot `patients` co nhieu `patient_journey_tasks`.

## departments

Bang luu danh muc khoa lon trong benh vien, vi du `Khoa Noi`, `Khoa Ngoai`.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua khoa. |
| `name` | Ten khoa, vi du `Khoa Noi`. |
| `code` | Ma khoa duy nhat neu can dung trong API, import seed, hoac hien thi ngan gon. |
| `is_active` | Khoa con dang duoc su dung hay da ngung hoat dong. |
| `created_at` | Thoi diem tao ban ghi. |
| `updated_at` | Thoi diem cap nhat gan nhat. |

Quan he chinh:

- Mot `departments` co nhieu `clinical_specialties`.
- Mot `departments` co the duoc gan vao nhieu `patient_journey_tasks`.

## clinical_specialties

Bang luu loai chuyen mon nam trong mot khoa. Vi du trong mot khoa co the co `Noi soi`, `Rang ham mat`, `Mat`.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua loai chuyen mon. |
| `department_id` | Khoa cha ma loai chuyen mon nay thuoc ve. |
| `name` | Ten loai chuyen mon, vi du `Mat`, `Noi soi`. |
| `code` | Ma loai chuyen mon duy nhat neu can. |
| `is_active` | Loai chuyen mon con dang duoc su dung hay da ngung. |
| `created_at` | Thoi diem tao ban ghi. |
| `updated_at` | Thoi diem cap nhat gan nhat. |

Rang buoc chinh:

- `department_id` lien ket den `departments.id`.
- Trong cung mot khoa, `department_id` + `name` khong duoc trung nhau.

## clinic_rooms

Bang luu cac phong kham/phong dich vu cu the nam trong mot loai chuyen mon. Vi du `Mat 1`, `Mat 2`, `Mat 3`.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua phong kham. |
| `specialty_id` | Loai chuyen mon ma phong nay thuoc ve. |
| `name` | Ten phong, vi du `Mat 1`. |
| `code` | Ma phong duy nhat neu can. |
| `floor` | Tang/khu vuc cua phong. |
| `is_active` | Phong con dang hoat dong hay da ngung. |
| `created_at` | Thoi diem tao ban ghi. |
| `updated_at` | Thoi diem cap nhat gan nhat. |

Rang buoc chinh:

- `specialty_id` lien ket den `clinical_specialties.id`.
- Trong cung mot loai chuyen mon, `specialty_id` + `name` khong duoc trung nhau.

## service_queues

Bang dinh nghia hang doi cua tung phong kham hoac tung dich vu. Thong thuong moi phong co mot queue rieng, vi du queue cua `Mat 1`.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua queue. Co the dung ma de doc nhu `QUEUE_EYE_1`. |
| `name` | Ten queue hien thi. |
| `room_id` | Phong kham ma queue nay gan vao. Co the null neu queue la queue cap dich vu/chua gan phong. |
| `service_type` | Loai dich vu ma queue phuc vu, vi du `XRAY`, `ABDOMINAL_ULTRASOUND`, `CLINICAL_CONSULT`. |
| `is_active` | Queue con dang hoat dong hay da ngung. |
| `created_at` | Thoi diem tao queue. |
| `updated_at` | Thoi diem cap nhat gan nhat. |

Quan he chinh:

- `room_id` lien ket den `clinic_rooms.id`.
- Mot `service_queues` co nhieu `patient_queue_entries`.
- Mot `service_queues` co the duoc gan truc tiep vao nhieu `patient_journey_tasks`.

## patient_journeys

Bang luu mot hanh trinh kham tong the cua benh nhan. Mot journey gom nhieu task nhu kham ban dau, chup X-ray, sieu am, quay lai review ket qua.

| Field | Y nghia |
| --- | --- |
| `journey_id` | Khoa chinh cua hanh trinh. |
| `patient_token` | Ma an danh/ma noi bo cua benh nhan trong data journey. Field nay map voi `patients.patient_token`. |
| `created_at` | Thoi diem tao journey. |
| `updated_at` | Thoi diem cap nhat journey gan nhat. |

Quan he chinh:

- Mot `patient_journeys` co nhieu `patient_journey_tasks`.
- `patient_token` lien ket den `patients.patient_token`.

## patient_journey_tasks

Bang luu tung buoc/task trong hanh trinh kham. Day la bang trung tam de noi workflow, queue va du lieu du doan thoi gian cho.

| Field | Y nghia |
| --- | --- |
| `task_id` | Khoa chinh cua task. |
| `journey_id` | Journey ma task nay thuoc ve. |
| `journey_step` | Buoc trong journey, vi du `INITIAL_CONSULT`, `DIAGNOSTIC_SERVICE`, `RESULT_PENDING`, `RETURN_REVIEW`. |
| `parent_task_id` | Task cha sinh ra task nay. Vi du task kham ban dau chi dinh them X-ray va sieu am. |
| `depends_on_task_id` | Cot giu lai dependency goc tu CSV seed. Neu can phu thuoc nhieu task, dung bang `patient_task_dependencies`. |
| `patient_token` | Ma benh nhan gan voi task, giup query nhanh ma khong can join journey. Field nay map voi `patients.patient_token`. |
| `department_id` | Khoa duoc chi dinh cho task, vi du `Khoa Mat`. Co the co truoc khi chon phong cu the. |
| `specialty_id` | Loai chuyen mon duoc chi dinh, vi du `Mat`, `Noi soi`. |
| `queue_id` | Queue ma task dang/du kien vao. |
| `room_id` | Phong kham cu the duoc gan cho task. |
| `task_type` | Loai task nghiep vu, vi du `INITIAL_CONSULT`, `DIAGNOSTIC_SERVICE`, `RETURN_REVIEW`. |
| `status` | Trang thai nghiep vu cua task: `PENDING`, `READY`, `IN_QUEUE`, `IN_SERVICE`, `WAITING_RESULT`, `COMPLETED`, `CANCELLED`, `SKIPPED`. |
| `service_type` | Loai dich vu cua task, vi du `CLINICAL_CONSULT`, `XRAY`, `ABDOMINAL_ULTRASOUND`, `RESULT_REVIEW`. |
| `clinical_priority` | Muc uu tien lam sang, vi du `NORMAL`, `URGENT`. |
| `readiness_status` | Trang thai san sang theo data seed, vi du `COMPLETED`, `RESULT_PENDING`. |
| `scheduling_mode` | Cach sap lich/xep hang, vi du `FAIR_QUEUE`, `SCHEDULED_WINDOW`. |
| `doctor_id` | Bac si thuc hien hoac duoc gan cho task. |
| `device_id` | Thiet bi/phong may duoc gan cho task neu co. |
| `assigned_at` | Thoi diem task duoc chi dinh/phan cong. |
| `arrival_time` | Thoi diem benh nhan den hoac task bat dau duoc ghi nhan. |
| `ready_at` | Thoi diem task san sang de vao queue hoac duoc thuc hien. |
| `service_start` | Thoi diem bat dau phuc vu/kham/lam dich vu. |
| `service_end` | Thoi diem ket thuc phuc vu/kham/lam dich vu. |
| `completed_at` | Thoi diem task hoan tat ve nghiep vu. |
| `cancelled_at` | Thoi diem task bi huy. |
| `result_ready_at` | Thoi diem ket qua san sang, dung cho xet nghiem/chan doan. |
| `result_urgency` | Muc khan cua ket qua, vi du `NORMAL`, `URGENT`. |
| `result_delay_minutes` | So phut tre/cho ket qua. |
| `return_timing` | Benh nhan quay lai som/dung gio/tre, vi du `EARLY`, `ON_TIME`, `LATE`. |
| `schedule_window_start` | Thoi diem bat dau cua khung hen neu task theo lich hen. |
| `schedule_window_end` | Thoi diem ket thuc cua khung hen. |
| `sequence_order` | Thu tu hien thi/thuc hien cua task trong journey. |
| `queue_length` | Do dai queue tai thoi diem ghi nhan task. Day la feature cho du doan wait time. |
| `arrival_rate_15m` | So luot den trong 15 phut gan nhat. |
| `avg_service_30m` | Thoi gian phuc vu trung binh trong 30 phut gan nhat. |
| `resource_status` | Trang thai tai nguyen/phong/thiet bi, vi du `AVAILABLE`. |
| `resource_failure` | Co su co tai nguyen hay khong. |
| `doctor_pause` | Bac si/phong co bi tam dung hay khong. |
| `case_complexity` | Do phuc tap ca benh, vi du `SIMPLE`, `NORMAL`, `COMPLEX`. |
| `active_service_duration` | Thoi gian phuc vu thuc te khong tinh gian doan. |
| `interruption_duration` | Thoi gian bi gian doan trong qua trinh phuc vu. |
| `elapsed_service_duration` | Tong thoi gian tu bat dau den ket thuc phuc vu, co tinh gian doan. |
| `actual_wait_time` | Thoi gian cho thuc te. Day co the la label de train model du doan. |
| `no_show` | Benh nhan khong co mat khi duoc goi hoac khong thuc hien task. |
| `emergency_insertion` | Co ca cap cuu/uu tien chen vao queue hay khong. |
| `recent_emergency_count` | So ca uu tien/cap cuu gan day. |
| `created_at` | Thoi diem tao task. |
| `updated_at` | Thoi diem cap nhat task gan nhat. |

Quan he chinh:

- `journey_id` lien ket den `patient_journeys.journey_id`.
- `patient_token` lien ket den `patients.patient_token`.
- `parent_task_id` lien ket den mot task cha trong `patient_journey_tasks.task_id`.
- `department_id` lien ket den `departments.id`.
- `specialty_id` lien ket den `clinical_specialties.id`.
- `room_id` lien ket den `clinic_rooms.id`.
- `queue_id` lien ket den `service_queues.id`.

## patient_task_dependencies

Bang luu dependency nhieu-nhieu giua cac task. Bang nay dung de xu ly luong song song, vi du task review chi duoc mo khi ca X-ray va sieu am deu hoan thanh.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh tu tang cua dependency. |
| `task_id` | Task dang bi chan/khong duoc lam neu dependency chua xong. |
| `depends_on_task_id` | Task ma `task_id` phai doi hoan thanh truoc. |
| `created_at` | Thoi diem tao quan he dependency. |

Vi du:

| `task_id` | `depends_on_task_id` | Y nghia |
| --- | --- | --- |
| `t-return-review` | `t-xray` | Review phai doi X-ray xong. |
| `t-return-review` | `t-ultrasound` | Review phai doi sieu am xong. |

Khi tat ca `depends_on_task_id` cua mot `task_id` da `COMPLETED`, task do co the chuyen tu `PENDING` sang `READY`.

## patient_queue_entries

Bang luu mot luot xep hang cu the cua mot task trong mot queue. Day la bang sinh ra du lieu queue thuc te: vao hang doi luc nao, duoc goi luc nao, bat dau/ket thuc phuc vu luc nao.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh cua queue entry. |
| `queue_id` | Queue ma task dang xep vao. |
| `task_id` | Task tuong ung trong journey. |
| `status` | Trang thai queue: `WAITING`, `CALLED`, `IN_SERVICE`, `DONE`, `CANCELLED`, `NO_SHOW`. |
| `priority` | Muc uu tien cua luot queue, vi du `NORMAL`, `URGENT`. |
| `queue_number` | So thu tu goi cua benh nhan trong queue. |
| `position` | Vi tri hien tai trong hang doi neu he thong can luu snapshot. |
| `enqueued_at` | Thoi diem vao hang doi. |
| `called_at` | Thoi diem phong goi benh nhan. |
| `service_start_at` | Thoi diem bat dau phuc vu trong queue. |
| `service_end_at` | Thoi diem ket thuc phuc vu trong queue. |
| `cancelled_at` | Thoi diem luot queue bi huy. |
| `created_at` | Thoi diem tao queue entry. |
| `updated_at` | Thoi diem cap nhat queue entry gan nhat. |

Quan he chinh:

- `queue_id` lien ket den `service_queues.id`.
- `task_id` lien ket den `patient_journey_tasks.task_id`.

Ghi chu:

- Hien schema dang rang buoc `task_id` + `queue_id` la duy nhat. Neu muon cho phep mot task vao lai cung mot queue nhieu lan sau `NO_SHOW`, nen them `attempt_no` va doi unique thanh `task_id` + `queue_id` + `attempt_no`.

## checkin_slot_statistics

Bang luu thong ke so luot check-in theo khung gio 30 phut, dung cho module du doan gio cao diem.

| Field | Y nghia |
| --- | --- |
| `id` | Khoa chinh tu tang cua ban ghi thong ke. |
| `checkin_time` | Thoi diem bat dau slot check-in, vi du `2025-07-01 08:30:00`. |
| `date` | Ngay cua slot. |
| `slot_start` | Gio bat dau slot dang text, vi du `08:30`. |
| `slot_index` | Thu tu slot trong ngay, vi du 0 den 19 neu moi slot 30 phut tu 07:00 den 16:30. |
| `day_of_week` | Thu trong tuan dang so. |
| `day_name` | Ten thu trong tuan, vi du `Tuesday`. |
| `month` | Thang cua slot. |
| `is_weekend` | Slot thuoc cuoi tuan hay khong. |
| `checkin_count` | So luot check-in trong slot. |
| `created_at` | Thoi diem tao ban ghi. |
| `updated_at` | Thoi diem cap nhat gan nhat. |

Rang buoc chinh:

- `checkin_time` la duy nhat.
- `date` + `slot_index` la duy nhat, tranh trung thong ke cung mot slot trong cung mot ngay.

## Tom tat quan he nghiep vu

```text
patients
  -> patient_journeys
    -> patient_journey_tasks

departments
  -> clinical_specialties
    -> clinic_rooms
      -> service_queues
        -> patient_queue_entries
          -> patient_journey_tasks
            -> patient_journeys
```

Dependency song song giua cac task:

```text
patient_journey_tasks
  -> patient_task_dependencies
  -> patient_journey_tasks
```

Vi du mot task `RETURN_REVIEW` phai doi ca `XRAY` va `ULTRASOUND`, bang `patient_task_dependencies` se co hai dong dependency rieng cho cung mot `task_id`.
