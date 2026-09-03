import React from 'react';
import { Outlet } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-between p-6 sm:p-10 text-[#0A0A0A]">
      {/* Top Header with Brand */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <BrandLogo size="md" />
        <span className="text-xs text-[#737373] hidden sm:inline">
          Personal Financial Intelligence
        </span>
      </header>

      {/* Centered Auth Card Container */}
      <main className="flex items-center justify-center my-8 w-full">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="text-center text-xs text-[#737373] max-w-5xl mx-auto w-full pt-4 border-t border-[#E5E5E3]">
        <p>&copy; {new Date().getFullYear()} FinSight. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AuthLayout;