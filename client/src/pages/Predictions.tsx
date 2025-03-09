import React from 'react';
import { Chart } from 'chart.js';

const Predictions: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Spending Predictions</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Forecast</h2>
          <div className="aspect-w-16 aspect-h-9">
            {/* Chart will go here */}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Category Predictions</h2>
          <div className="space-y-4">
            {/* Category predictions will go here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Predictions; 