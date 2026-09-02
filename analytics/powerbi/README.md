# MedFlow Enterprise Power BI Analytics Data Model

This directory contains the semantic definitions, Star Schema specifications, and DAX calculations for MedFlow hospital operations analytics in Power BI.

---

## 1. Star Schema Architecture

The Gold Layer data model consists of 2 Fact tables and 6 Dimension tables:

```
                  +-------------------+
                  |     dim_date      |
                  +-------------------+
                            | 1
                            |
                            | *
+-----------------+ *       |       * +-------------------+
|   dim_patient   |----+----+--------| fact_patient_journey|
+-----------------+    |    |         +-------------------+
                       |    |                   | 1
+-----------------+ *  |    |                   |
|   dim_doctor    |----+----+                   | *
+-----------------+    |    |         +-------------------+
                       |    +-------->|fact_task_execution|
+-----------------+ *  |              +-------------------+
| dim_clinic_room |----+                        | *
+-----------------+    |                        |
                       |                        | 1
+-----------------+ *  |              +-------------------+
| dim_specialty   |----+              |   dim_time_slot   |
+-----------------+                   +-------------------+
```

---

## 2. Table Catalog & Data Sources

| Table Name | Role | Primary Key | Description | Source File |
| :--- | :--- | :--- | :--- | :--- |
| `fact_task_execution` | Fact | `task_id` | Execution timestamps, wait times, durations, queues | `gold/fact_task_execution.parquet` |
| `fact_patient_journey` | Fact | `journey_id` | End-to-end journey metrics, severity, total duration | `gold/fact_patient_journey.parquet` |
| `dim_patient` | Dimension | `patient_token` | Masked patient demographics (SHA-256 CCCD) | `gold/dim_patient.parquet` |
| `dim_doctor` | Dimension | `doctor_id` | Staff user, assigned room, specialty | `gold/dim_doctor.parquet` |
| `dim_clinic_room` | Dimension | `room_id` | Room code, floor, equipment, status | `gold/dim_clinic_room.parquet` |
| `dim_specialty` | Dimension | `specialty_id` | Clinical specialty, department hierarchy | `gold/dim_specialty.parquet` |
| `dim_date` | Dimension | `date_key` | Full calendar date, DayOfWeek, Month, Year | `gold/dim_date.parquet` |
| `dim_time_slot` | Dimension | `slot_key` | 30-min time slot index, peak period flag | `gold/dim_time_slot.parquet` |

---

## 3. Key DAX Measures Catalog

All DAX formulas are defined in [`DAX_Measures.dax`](./DAX_Measures.dax). Key measures include:
- `Total Patient Journeys`, `Completed Tasks`, `Throughput Rate`
- `Average Wait Time (Minutes)`, `Median Wait Time (P50)`, `P80 Wait Time`, `P90 Wait Time`, `IQR Wait Time`
- `Initial Consult Average Wait`, `Diagnostic Average Wait`, `Return Review Average Wait`
- `SLA Compliance Rate (%)`, `SLA Breach Rate (%)`
- `Peak Hour Checkin Volume`, `Journeys MoM Growth (%)`

---

## 4. How to Connect in Power BI Desktop

1. Open **Power BI Desktop**.
2. Select **Get Data** -> **Folder** or **Parquet** -> Browse to `analytics/data/gold/`.
3. Load the 8 dimension and fact parquet/csv files.
4. Establish 1-to-many single-direction relationships from Dimensions to Facts.
5. Create a new Measures Table and import the DAX expressions from `DAX_Measures.dax`.
