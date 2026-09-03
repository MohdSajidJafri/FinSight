from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime
import pandas as pd
import numpy as np

try:
    from prophet import Prophet
except Exception:
    Prophet = None

app = FastAPI(title="FinSight ML Service", version="0.2.0")


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


def get_freq_alias(period: str) -> str:
    """Return pandas resample alias compatible across pandas versions."""
    is_pandas_v2_2 = hasattr(pd.offsets, 'MonthEnd')
    if period == 'weekly':
        return 'W'
    elif period == 'monthly':
        return 'ME' if is_pandas_v2_2 else 'M'
    elif period == 'yearly':
        return 'YE' if is_pandas_v2_2 else 'Y'
    return 'D'


def statistical_forecast(df: pd.DataFrame, period: str, horizon: int) -> List[ForecastPoint]:
    """
    Robust Ordinary Least Squares trend + standard error forecasting fallback.
    Guaranteed to run without Prophet or heavy C++ toolchains.
    """
    n = len(df)
    if n == 0:
        raise HTTPException(status_code=400, detail="Empty time series data")

    last_date = df['ds'].iloc[-1]
    y = df['y'].to_numpy(dtype=float)

    if n == 1:
        # Single point baseline
        val = max(0.0, float(y[0]))
        out = []
        for step in range(1, horizon + 1):
            next_date = last_date + pd.DateOffset(
                days=step if period == 'daily' else 0,
                weeks=step if period == 'weekly' else 0,
                months=step if period == 'monthly' else 0,
                years=step if period == 'yearly' else 0
            )
            out.append(ForecastPoint(
                date=next_date.to_pydatetime(),
                yhat=val,
                yhat_lower=max(0.0, val * 0.8),
                yhat_upper=val * 1.2
            ))
        return out

    x = np.arange(n, dtype=float)
    x_mean = np.mean(x)
    y_mean = np.mean(y)

    den = np.sum((x - x_mean) ** 2)
    slope = np.sum((x - x_mean) * (y - y_mean)) / den if den > 0 else 0.0
    intercept = y_mean - slope * x_mean

    # Residual standard error
    residuals = y - (intercept + slope * x)
    dof = max(1, n - 2)
    std_err = float(np.sqrt(np.sum(residuals ** 2) / dof))

    out = []
    for step in range(1, horizon + 1):
        future_x = (n - 1) + step
        pred_y = float(intercept + slope * future_x)
        # Weight towards recent Exponential Moving Average to prevent wild swings
        recent_ema = float(df['y'].ewm(span=min(3, n)).mean().iloc[-1])
        blended = 0.5 * pred_y + 0.5 * recent_ema
        val = max(0.0, round(blended, 2))
        lower = max(0.0, round(val - 1.96 * std_err, 2))
        upper = max(val, round(val + 1.96 * std_err, 2))

        next_date = last_date + pd.DateOffset(
            days=step if period == 'daily' else 0,
            weeks=step if period == 'weekly' else 0,
            months=step if period == 'monthly' else 0,
            years=step if period == 'yearly' else 0
        )
        out.append(ForecastPoint(
            date=next_date.to_pydatetime(),
            yhat=val,
            yhat_lower=lower,
            yhat_upper=upper
        ))

    return out


@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "prophet_available": Prophet is not None,
        "service": "FinSight ML Service"
    }


@app.post("/forecast", response_model=List[ForecastPoint])
def forecast(req: ForecastRequest):
    if not req.series or len(req.series) < 2:
        raise HTTPException(status_code=400, detail="At least 2 time-series data points are required")

    try:
        # Prepare dataframe and aggregate multiple points on identical timestamps
        raw_df = pd.DataFrame([
            {"ds": p.date, "y": float(p.value)} for p in req.series
        ])
        raw_df['ds'] = pd.to_datetime(raw_df['ds']).dt.tz_localize(None)
        df = raw_df.groupby('ds', as_index=False)['y'].sum().sort_values('ds')

        freq = get_freq_alias(req.period)

        # Resample to the requested period and fill gaps with 0
        df = df.set_index('ds').resample(freq).sum().fillna(0).reset_index()

        span_days = (df['ds'].max() - df['ds'].min()).days

        # Use Prophet if installed and dataset has sufficient history (>= 60 days)
        if Prophet is not None and len(df) >= 3 and span_days >= 60:
            try:
                yearly_seasonality = span_days >= 730
                weekly_seasonality = span_days >= 14 and req.period == 'daily'
                model = Prophet(
                    yearly_seasonality=yearly_seasonality,
                    weekly_seasonality=weekly_seasonality,
                    daily_seasonality=False
                )
                model.fit(df)

                future = model.make_future_dataframe(periods=req.horizon, freq=freq, include_history=False)
                fcst = model.predict(future)

                out = []
                for _, row in fcst.iterrows():
                    pred = max(0.0, float(row['yhat']))
                    out.append(ForecastPoint(
                        date=row['ds'].to_pydatetime(),
                        yhat=round(pred, 2),
                        yhat_lower=round(max(0.0, float(row.get('yhat_lower', pred * 0.8))), 2),
                        yhat_upper=round(max(pred, float(row.get('yhat_upper', pred * 1.2))), 2)
                    ))
                return out
            except Exception as prophet_err:
                # Log Prophet fitting failure and fall through to statistical forecasting
                print(f"[Prophet Warning] {prophet_err}. Falling back to statistical forecast.")

        # Fallback to robust OLS + EMA trend forecasting
        return statistical_forecast(df, req.period, req.horizon)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")
