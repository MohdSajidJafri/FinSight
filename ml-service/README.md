FinSight ML Service (FastAPI + Prophet)

Run locally

```
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

API
- POST `/forecast`
  - Body:
```
{
  "series": [{"date": "2024-01-01", "value": 123.4}, ...],
  "period": "monthly" | "weekly" | "daily" | "yearly",
  "horizon": 1
}
```
  - Returns:
```
[
  {"date": "2024-06-30T00:00:00Z", "yhat": 200.1, "yhat_lower": 150.0, "yhat_upper": 250.0},
  ...
]
```

Set ML_SERVICE_URL in the Node server (default http://localhost:8000).
