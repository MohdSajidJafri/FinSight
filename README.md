# FinSight AI - Intelligent Personal Finance Dashboard

FinSight AI is an advanced personal finance management application that helps users track expenses, manage budgets, and visualize spending patterns with an intuitive interface.

## Features

- **Transaction Management**
  - Add income and expense transactions
  - Categorize transactions with predefined or custom categories
  - Track transaction dates and descriptions
  - View transaction history in a clean, organized table

- **Budget Management**
  - Create and manage budgets for different expense categories
  - Set weekly, monthly, or yearly budget periods
  - Track spending progress with visual progress bars
  - Get real-time updates on remaining budget amounts
  - Add notes to budget items for better organization

- **Dashboard Analytics**
  - View total balance, income, and expenses
  - Track spending by category with interactive charts
  - Monitor budget utilization in real-time
  - See spending predictions based on historical data
  - Visualize financial trends with intuitive graphs

- **Smart Features**
  - Automatic budget tracking and updates
  - Real-time spending calculations
  - Custom category support
  - Responsive design for all devices

## Tech Stack

- **Frontend**
  - React.js with TypeScript
  - Tailwind CSS for styling
  - Chart.js for data visualization
  - Zustand for state management

- **Backend**
  - Node.js with Express
  - MongoDB for data storage
  - JWT for authentication
  - RESTful API architecture

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/MohdSajidJafri/FinSight.git
cd finsight-ai
```

2. Install dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

3. Set up environment variables
```bash
# In the server directory, create a .env file
cp .env.example .env
```

4. Start the development servers
```bash
# Start the backend server
cd server
npm run dev

# In a new terminal, start the frontend
cd client
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
finsight-ai/
├── client/                 # Frontend React application
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Main application pages
│       │   ├── Dashboard.tsx     # Main dashboard view
│       │   ├── Transactions.tsx  # Transaction management
│       │   ├── Budget.tsx        # Budget management
│       │   └── AddTransaction.tsx # Add new transactions
│       ├── stores/        # Zustand state management
│       └── types/         # TypeScript type definitions
├── server/                # Backend Node.js application
│   ├── controllers/       # Request handlers
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   └── middleware/       # Custom middleware
```

## Usage

1. **Adding Transactions**
   - Click "Add Transaction" from the Transactions page
   - Select transaction type (income/expense)
   - Choose or create a category
   - Enter amount and description
   - Set the date
   - Submit to save

2. **Managing Budgets**
   - Navigate to the Budget section
   - Click "Add Budget" to create a new budget
   - Select a category and set the amount
   - Choose the budget period
   - Add optional notes
   - Monitor spending progress in real-time

3. **Viewing Analytics**
   - Check the Dashboard for overview
   - View spending breakdowns by category
   - Monitor budget utilization
   - Track financial trends

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
