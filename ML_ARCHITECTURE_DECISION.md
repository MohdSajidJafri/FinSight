# FinSight Machine Learning Architecture Decision (ADR-001)

## 1. What the Current ML Pipeline Does

The existing ML forecasting pipeline was designed as an external Python microservice in `ml-service/`:
- **Framework**: FastAPI application (`ml-service/main.py`) using Meta's `Prophet` time-series forecasting library.
- **Data Flow**:
  1. The Node.js server (`server/services/predictionService.js`) queries user transactions from MongoDB (`type: 'expense'`, filtered by category and period).
  2. If `options.model === 'prophet'`, Node.js formats the transactions into `[{ date, value }]` time-series points and sends an HTTP `POST /forecast` request to the Python service (`http://localhost:8000/forecast` or `process.env.ML_SERVICE_URL`).
  3. The Python service loads data into a Pandas DataFrame (`ds`, `y`), sets a daily frequency, resamples according to period (`'W'`, `'M'`, `'Y'`), fits a Prophet model (`Prophet(yearly_seasonality=True)`), and forecasts `horizon` periods into the future with uncertainty intervals (`yhat`, `yhat_lower`, `yhat_upper`).
  4. The forecast points are returned to Node.js, which stores them in MongoDB (`Prediction` collection) and returns them to the frontend (`client/src/pages/Predictions.tsx`).

## 2. Why the Current Pipeline Fails

Through our audit, five distinct points of failure were identified across the pipeline:

1. **Dependency & Platform Incompatibility (`ml-service/requirements.txt`)**:
   `requirements.txt` specifies `pystan==3.7.0` alongside `prophet==1.1.5`. Prophet >= 1.1 uses `cmdstanpy`, not `pystan`. Furthermore, PyStan 3 explicitly does not support Windows, and Prophet compilation requires C++ toolchains and >512MB RAM, causing build/boot failures on small cloud instances (e.g. Render free tier).
2. **Pandas Timestamp Index Collision (`ml-service/main.py`)**:
   Line 53 executes `df = df.set_index("ds").asfreq("D").fillna(0)`. When a user enters multiple transactions on the same date (e.g., lunch and dinner on the same day), setting `"ds"` as index without aggregating first causes an `InvalidIndexError: Reindexing only valid with uniquely valued Index objects`, crashing the Python service with HTTP 500.
3. **Pandas 2.2 Frequency Alias Deprecations & Column Renaming**:
   Pandas 2.2 deprecated `'M'` and `'Y'` frequency aliases in favor of `'ME'` and `'YE'`. Also, line 63 renames column `"index"` to `"ds"`, which fails when `"ds"` was already the index name.
4. **Prophet Data Sufficiency Failure**:
   Fitting Prophet with `yearly_seasonality=True` requires at least 2 full years of data points. For personal finance users with weeks or a few months of transaction history, Prophet warns or fails with convergence errors.
5. **Frontend-to-Backend Disconnect**:
   `Predictions.tsx` calls `POST /api/predictions/expenses` with `{ period }` without specifying `model: 'prophet'`. The backend defaults `options.model` to undefined, completely bypassing the Prophet service in standard usage and falling through to the Node.js heuristic which itself failed due to a division-by-zero bug on same-day transactions.
6. **Mongoose Aggregation BSON Type Mismatch**:
   In `predictionService.js`, `Transaction.aggregate` queried `$match: { user: userId }` where `userId` was a string. MongoDB native aggregation pipelines require BSON `ObjectId`, matching 0 transactions and causing `NaN` calculations that crash Mongoose model validation on `predictedAmount`.

## 3. Whether Prophet Should Remain

**Decision: YES, Prophet should remain in `ml-service` as an advanced time-series forecasting capability, but it must be repaired, decoupled, and supplemented with an accurate statistical engine.**

- **Why keep Prophet**:
  Prophet is well-suited for long-term time-series with multiple seasonalities (weekly + yearly) when users have substantial historical data (1–2+ years). Retaining Prophet fulfills the original architectural vision of FinSight AI as an intelligent forecasting platform.
- **What must be fixed in Prophet service**:
  - Remove broken `pystan` dependency.
  - Group and sum transactions on identical dates before resampling.
  - Use modern Pandas frequency codes (`'ME'`, `'W'`, `'D'`).
  - Configure Prophet parameters dynamically based on data length (only enable yearly seasonality if data span >= 730 days; enable weekly seasonality if data points >= 14).
  - If Prophet fails or is unavailable, `ml-service` must execute a robust statistical Holt-Winters / linear trend forecast rather than returning HTTP 500.

## 4. What the Fallback Does

The Node.js backend (`predictionService.js`) includes a built-in time-series inference engine:
1. **Aggregates historical transactions** by period (daily, weekly, monthly).
2. **Computes true Ordinary Least Squares (OLS) linear regression** across all historical intervals:
   - Slope ($m$) and intercept ($b$) calculated from $(x_i, y_i)$ pairs.
   - Detects upward, downward, or stable spending trajectories.
3. **Applies Exponential Moving Average (EMA) / Recency Weighting**:
   - Recent spending patterns carry higher weight than distant history.
4. **Variance & Confidence Scoring**:
   - Confidence score ($0.0 - 1.0$) based on coefficient of variation, sample size, and recency.
5. **Zero-Division & Edge-Case Guards**:
   - Safely handles 0 transactions (falls back to budget), 1 transaction (uses transaction amount as baseline with conservative confidence), and same-day clusters without producing `NaN` or `Infinity`.

## 5. Primary Production Prediction Path & Architectural Tradeoff

| Dimension | Primary Path: Built-In Node.js Inference Engine | Secondary / Advanced Path: External Python Prophet Service (`ml-service`) |
| :--- | :--- | :--- |
| **Role in Production** | **Primary Default Path** | **Optional / Opt-in Enhanced ML Path** |
| **Availability** | 100% available with zero external dependencies | Requires running Python microservice (`ML_SERVICE_URL`) |
| **Cold-Start Impact** | 0ms cold-start; instant execution within Node process | 30–60s cold start if hosted on separate free-tier container |
| **Data Requirement** | Functions reliably on 1 to 1000+ transactions | Requires at least 5+ intervals for meaningful fit |
| **Resource Footprint**| < 5MB memory; runs in existing server process | 200–500MB memory for Python + PyStan/CmdStanPy |
| **Confidence & Bounds**| Provides deterministic trend + confidence score | Provides statistical prediction intervals (`yhat_lower`, `yhat_upper`) |

**Tradeoff Summary**:
Defaulting to the Node.js built-in engine guarantees that any production deployment (such as a single Node.js container on Render) is 100% functional, resilient, fast, and immune to cross-service network drops. When an operator runs the Python `ml-service` (locally or as a microservice) and configures `ML_SERVICE_URL`, users can leverage Prophet's Bayesian curve fitting for multi-seasonal projections.
