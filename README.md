# FinSight — Intelligent Personal Finance & Predictive Budgeting

FinSight is an editorial, minimalist fintech application engineered for personal finance tracking, analytical budgeting, and forward-looking time-series predictive modeling. Built with a calm, high-contrast monochrome design philosophy, FinSight combines precision transaction management with dual-engine forecasting (Facebook Prophet ML + native statistical regression).

---

## Architecture Overview

```
                          ┌─────────────────────────────┐
                          │   React 18 + TypeScript     │
                          │   Tailwind CSS + Chart.js   │
                          │   (Deployed on Vercel)      │
                          └──────────────┬──────────────┘
                                         │
                         Canonical /api  │ (CORS + Bearer JWT)
                                         ▼
                          ┌─────────────────────────────┐
                          │   Express + Node.js Engine  │
                          │   (Prompt Port Binding)     │
                          │   (Deployed on Render)      │
                          └──────┬───────────────┬──────┘
                                 │               │
                        Mongoose │               │ HTTP /forecast
                                 ▼               ▼
                 ┌──────────────────┐    ┌───────────────────────────┐
                 │  MongoDB Atlas   │    │  FastAPI + Prophet ML     │
                 │  (Replica Set)   │    │  (Microservice / Fallback)│
                 └──────────────────┘    └───────────────────────────┘
```

- **Client (`/client`)**: React 18 with TypeScript, Tailwind CSS, Chart.js, and Zustand. Minimalist white aesthetic (`#FFFFFF`), hairline borders (`#E5E5E3`), solid black controls (`#0A0A0A`), tabular numerals (`tabular-nums`), and strict zero-emoji design.
- **Server (`/server`)**: Node.js & Express REST API with prompt port binding for cloud cold starts, distinguishing process liveness (`/health/live`) from database readiness (`/health/ready`).
- **ML Engine (`/ml-service` & `/server/services/predictionService.js`)**: Dual-engine architecture featuring Facebook Prophet time-series modeling for seasonality, coupled with an integrated Ordinary Least Squares (OLS) + Exponential Moving Average (EMA) mathematical fallback.

---

## Visual Design System & UI/UX

FinSight features an editorial, high-precision visual system inspired by modern financial journalism and minimalist fintech:

- **85–90% Monochrome Palette**:
  - Canvas: Pure white (`#FFFFFF`)
  - Elevated surfaces & hover states: Light gray (`#F9F9F8` / `#F4F4F2`)
  - Hairline borders: Neutral gray (`#E5E5E3`)
  - Typography & Primary Actions: Solid near-black (`#0A0A0A`)
  - Positive Cash Flow & Gains: Restrained green (`#16A34A`)
  - Expenses & Negative Cash Flow: Restrained red (`#DC2626`)
- **Strict Zero-Emoji Policy**: Zero emojis across all headings, greetings, empty states, and buttons. Icons are strictly semantic line vectors.
- **Tabular Figures**: All financial numbers use `tabular-nums` for vertical column alignment.
- **Brand Mark**: Intentional geometric forward-vision glyph + clean **FinSight** wordmark.
- **Clean Single-Series Cash Flow**: Replaced cluttered multi-dataset charts with a single black net cash-flow curve over a subtle zero baseline.

---

## Key Features

- **Instant Demo / Test Login**: One-click instant guest login (`POST /api/auth/guest`) pre-seeding realistic categories, budgets, and transactions for immediate live evaluation.
- **Financial Ledger**: Full income and expense tracking with search, category filters, type segmentation, pagination, and deletion.
- **Period Budgeting**: Weekly, monthly, and yearly categorized spending limits with automated spending windows, circular radial progress meters, and over-budget risk indicators.
- **Predictive Analytics & Forecasting**:
  - **Category Expense Forecasting**: Forward projections based on transaction trends and budget allocations.
  - **Projected Savings**: Forward-looking savings accumulation trajectory over the forecast horizon.
  - **Budget Recommendations**: Actionable observations derived from real spending patterns.
- **Enterprise-Grade Security**:
  - Authorization header precedence (`Bearer <token>`).
  - IDOR protection across transaction, budget, and category modification endpoints.
  - Safe password updates (preventing double-hashing).
  - Production cross-site cookie policies (`secure: true`, `sameSite: 'none'`).
- **Cloud-Ready Reliability**:
  - Immediate HTTP port binding on process launch for Render cold starts.
  - Granular liveness and readiness health checks.
  - Auto-retrying MongoDB connection logic.

---

## API Endpoints (Canonical Base: `/api`)

### Health & Operations
| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/health/live` (or `/livez`) | Process liveness probe (immediate port bind) | 200 |
| `GET` | `/health/ready` (or `/readyz`) | Database readiness probe | 200 or 503 |
| `GET` | `/health` or `/api/health` | Comprehensive health metrics | 200 or 503 |

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/guest` | Public | Instant demo login with pre-seeded sample data |
| `POST` | `/api/auth/register` | Public | Register new user and seed default categories |
| `POST` | `/api/auth/login` | Public | Authenticate user and issue JWT |
| `GET` | `/api/auth/me` | Private | Get authenticated user profile |
| `GET` | `/api/auth/logout` | Public | Clear authentication cookie and session |

### Transactions (`/api/transactions`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | Private | List transactions with search, filtering & pagination |
| `POST` | `/api/transactions` | Private | Create income or expense transaction |
| `GET` | `/api/transactions/:id` | Private | Get transaction by ID |
| `PUT` | `/api/transactions/:id` | Private | Update transaction (with IDOR protection) |
| `DELETE` | `/api/transactions/:id` | Private | Delete transaction |
| `GET` | `/api/transactions/stats` | Private | Aggregated income, expense & category totals |

### Predictions & Forecasting (`/api/predictions`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/predictions` | Private | Fetch active predictions |
| `POST` | `/api/predictions/expenses` | Private | Generate category expense forecast |
| `POST` | `/api/predictions/savings` | Private | Generate projected savings forecast |
| `GET` | `/api/predictions/recommendations` | Private | Get budget optimization recommendations |

### Budgets (`/api/budgets`) & Categories (`/api/categories`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` / `POST` | `/api/budgets` | Private | List or create period budgets |
| `PUT` / `DELETE` | `/api/budgets/:id` | Private | Update or delete budget |
| `GET` / `POST` | `/api/categories` | Private | List or create custom categories |

---

## Getting Started

### Prerequisites
- Node.js (>= 18.0.0)
- MongoDB (v6.0+ local or MongoDB Atlas replica set)
- Python 3.10+ (optional, required only if running the Prophet microservice locally)

### 1. Environment Setup

#### Server Configuration (`server/.env`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finsight
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
CORS_ORIGIN=http://localhost:3000
# Optional Prophet ML service (leave blank to use the built-in resilient Node.js engine)
ML_SERVICE_URL=
```

#### Client Configuration (`client/.env`):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 2. Running Locally

```bash
# Start backend server
cd server
npm install
npm run dev

# In a separate terminal, start frontend client
cd client
npm install
npm start
```

Access the frontend at `http://localhost:3000` and the API at `http://localhost:5000/api`.

---

## Automated Test Suites

### Backend Jest Suite (Supertest + Unit + IDOR + Health + Guest Auth)
```bash
cd server
npm test
```
*Executes 30 automated integration tests validating guest auth, IDOR sanitization, transaction CRUD, budget periods, statistical prediction safety, and health probes.*

### Frontend Production Build Verification
```bash
cd client
npm run build
```
*Validates TypeScript types and generates optimized, gzipped production bundles with 0 errors and 0 warnings.*

### Python ML Service Unit Tests
```bash
cd ml-service
python -m unittest test_main.py
```
*Validates frequency aliases, date deduplication, OLS time-series forecasting, and FastAPI endpoints.*

---

## Cloud Deployment Guide

### Render (Backend)
- **Environment**: Node
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && node index.js`
- **Health Check Path**: `/health/live`
- **Environment Variables**:
  - `NODE_ENV=production`
  - `PORT=10000`
  - `MONGODB_URI=<your-atlas-uri>`
  - `JWT_SECRET=<strong-random-key>`
  - `JWT_COOKIE_EXPIRE=30`
  - `CORS_ORIGIN=https://<your-app>.vercel.app`

### Vercel (Frontend)
- **Framework**: Create React App
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `build`
- **Environment Variables**:
  - `REACT_APP_API_URL=https://<your-render-backend>.onrender.com/api`

---

## License
MIT License.
