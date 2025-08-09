from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime
import pandas as pd

try:
    from prophet import Prophet
except Exception as e:
    Prophet = None

app = FastAPI(title="FinSight ML Service", version="0.1.0")


class SeriesPoint(BaseModel):
    date: datetime
    value: float


class ForecastRequest(BaseModel):
    series: List[SeriesPoint] = Field(..., description="Time series points")
    period: Literal['daily', 'weekly', 'monthly', 'yearly'] = 'monthly'
    horizon: int = Field(1, ge=1, le=12)


class ForecastPoint(BaseModel):
    date: datetime
    yhat: float
    yhat_lower: float
    yhat_upper: float


@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/forecast", response_model=List[ForecastPoint])
def forecast(req: ForecastRequest):
    if Prophet is None:
        raise HTTPException(status_code=500, detail="Prophet is not available on this server")

    if len(req.series) < 3:
        # Not enough data
        raise HTTPException(status_code=400, detail="Not enough data for forecasting")

    # Prepare dataframe
    df = pd.DataFrame([
        {"ds": p.date, "y": float(p.value)} for p in req.series
    ]).sort_values("ds")

    # Aggregate to requested frequency if needed
    df = df.set_index("ds").asfreq("D").fillna(0)  # daily fill, then resample
    if req.period == 'weekly':
        df = df.resample('W').sum()
    elif req.period == 'monthly':
        df = df.resample('M').sum()
    elif req.period == 'yearly':
        df = df.resample('Y').sum()
    else:
        # keep daily
        pass
    df = df.reset_index().rename(columns={"index": "ds"})

    # Fit Prophet
    model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    model.fit(df)

    # Build future frame
    if req.period == 'weekly':
        freq = 'W'
    elif req.period == 'monthly':
        freq = 'M'
    elif req.period == 'yearly':
        freq = 'Y'
    else:
        freq = 'D'

    future = model.make_future_dataframe(periods=req.horizon, freq=freq, include_history=False)
    fcst = model.predict(future)

    out = []
    for _, row in fcst.iterrows():
        out.append(ForecastPoint(
            date=row['ds'].to_pydatetime(),
            yhat=max(0.0, float(row['yhat'])),
            yhat_lower=max(0.0, float(row.get('yhat_lower', row['yhat']))),
            yhat_upper=max(0.0, float(row.get('yhat_upper', row['yhat'])))
        ))

    return out

