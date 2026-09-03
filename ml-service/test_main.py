import unittest
from datetime import datetime, timedelta
import pandas as pd
from main import get_freq_alias, statistical_forecast, ForecastPoint


class TestMLService(unittest.TestCase):
    def test_freq_alias(self):
        self.assertIn(get_freq_alias('monthly'), ['ME', 'M'])
        self.assertEqual(get_freq_alias('weekly'), 'W')
        self.assertIn(get_freq_alias('yearly'), ['YE', 'Y'])
        self.assertEqual(get_freq_alias('daily'), 'D')

    def test_statistical_forecast_multistep(self):
        base_date = datetime(2025, 1, 1)
        df = pd.DataFrame([
            {"ds": base_date, "y": 100.0},
            {"ds": base_date + timedelta(days=30), "y": 120.0},
            {"ds": base_date + timedelta(days=60), "y": 140.0},
        ])
        results = statistical_forecast(df, period='monthly', horizon=3)
        self.assertEqual(len(results), 3)
        for r in results:
            self.assertIsInstance(r, ForecastPoint)
            self.assertGreaterEqual(r.yhat, 0.0)
            self.assertGreaterEqual(r.yhat_upper, r.yhat)
            self.assertLessEqual(r.yhat_lower, r.yhat)

    def test_statistical_forecast_single_point(self):
        df = pd.DataFrame([{"ds": datetime(2025, 1, 1), "y": 75.0}])
        results = statistical_forecast(df, period='monthly', horizon=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].yhat, 75.0)

    def test_forecast_api_endpoint(self):
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        
        # Health
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

        # Forecast POST
        payload = {
            "series": [
                {"date": "2025-01-01T00:00:00Z", "value": 100},
                {"date": "2025-02-01T00:00:00Z", "value": 120},
                {"date": "2025-03-01T00:00:00Z", "value": 130}
            ],
            "period": "monthly",
            "horizon": 2
        }
        post_res = client.post("/forecast", json=payload)
        self.assertEqual(post_res.status_code, 200)
        data = post_res.json()
        self.assertEqual(len(data), 2)
        self.assertGreaterEqual(data[0]["yhat"], 0)


if __name__ == '__main__':
    unittest.main()
