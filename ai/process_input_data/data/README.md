# Dataset điều phối khoa

Các file trong thư mục này là dữ liệu **tổng hợp, chưa được thẩm định lâm sàng**:

- `symptom_routing_cases.csv`: 1.000 câu triệu chứng và nhãn khoa, có train/validation/test split.
- `red_flag_cases.csv`: 1.000 trường hợp dùng kiểm thử rule engine.
- `symptom_dictionary.csv`: biến thể triệu chứng, câu không dấu và lỗi chính tả.
- `departments.csv`: giới hạn tuổi, giới và trạng thái của 15 khoa.
- `routing_rules.csv`: luật điều phối tổng hợp tham khảo.
- `department_capability_map.csv`: ánh xạ triệu chứng và năng lực khoa.

Không dùng trực tiếp dữ liệu này để quyết định điều phối bệnh nhân thật.
