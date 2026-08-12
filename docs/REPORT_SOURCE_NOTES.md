# Verification report source notes

- Audience: technical. Decision: whether the repository is reliable enough for a local one-worker integration demo and what remains before a production claim.
- Comparison basis: repository baseline at the start of 11 August 2026 versus the final local verification run.
- Chart map: section “generator defects”; question “did remediation remove the observed failures?”; grouped categorical bar; fields `phase`, `metric`, `value`; claim “failed checks and critical/high affected records reached zero”; source `analytics/outputs/data_quality_summary.json` plus the baseline version in Git; two-root categorical palette delegated to the shared artifact renderer.
- A chart was omitted for test results because every failure/skip value is zero and exact service-level lookup is the audit need. A chart was omitted for model metrics because MAE/RMSE minutes and quantile coverage fractions are mixed units; a table avoids a misleading shared scale.
- Robustness: all claims distinguish local SQLite/thread evidence from PostgreSQL multi-process behavior; synthetic metrics are not treated as clinical or production evidence.
- Required technical-report structure mapping: title; technical summary; key evidence; scope/definitions/method; limitations/robustness; recommended next steps; further questions. The data-quality chart is adjacent to its interpretation and followed by exact values.
