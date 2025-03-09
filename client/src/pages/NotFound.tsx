import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-medium text-gray-600">Page Not Found</h2>
        <div className="mt-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-500">
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 