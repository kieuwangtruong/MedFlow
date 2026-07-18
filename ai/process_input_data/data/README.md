# Dataset điều phối phòng khám

Các file trong thư mục này là dữ liệu **tổng hợp, chưa được thẩm định lâm sàng**:

- `unified_symptom_routing.csv`: dữ liệu train chính gồm 5.000 câu triệu chứng giàu ngữ cảnh, khoa, phòng khám, mức nguy hiểm và train/validation/test split 70/15/15. Dữ liệu tổng hợp, chưa được thẩm định lâm sàng.
- `red_flag_cases.csv`: 1.000 trường hợp dùng kiểm thử rule engine.
- `departments.csv`: giới hạn tuổi, giới và trạng thái của 15 khoa.

Model học trực tiếp cặp `symptom_input` → `clinic_room`. Khoa tương ứng và mức
nguy hiểm được giữ trong cùng một dòng để phục vụ API và kiểm tra dữ liệu.

Không dùng trực tiếp dữ liệu này để quyết định điều phối bệnh nhân thật.
