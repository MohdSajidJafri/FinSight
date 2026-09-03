import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-[#0A0A0A]">
      <BrandLogo size="lg" showSubtitle className="mb-8" />
      <div className="bg-white border border-[#E5E5E3] rounded-2xl p-8 sm:p-12 max-w-md w-full shadow-sm">
        <span className="text-5xl font-black text-[#0A0A0A]">404</span>
        <h2 className="text-xl font-bold text-[#0A0A0A] mt-3 mb-2">Page Not Found</h2>
        <p className="text-xs text-[#737373] mb-6">
          The financial dashboard view you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;