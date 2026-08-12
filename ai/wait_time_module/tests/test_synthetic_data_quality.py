from scripts.generate_synthetic_data import generate


def test_synthetic_journey_steps_are_chronological():
    frame = generate(n=20, days=30, seed=42)
    for _, journey in frame.groupby("journey_id"):
        ordered = journey.sort_values("task_id", key=lambda values: values.str.extract(r"(\d+)")[0].astype(int))
        assert ordered["arrival_time"].is_monotonic_increasing
        duration = (ordered["service_end"].max() - ordered["arrival_time"].min()).total_seconds() / 60
        assert duration < 24 * 60
