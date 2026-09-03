import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { BrandLogo } from '../common/BrandLogo';
import {
  Squares2X2Icon,
  ReceiptPercentIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Dashboard', path: '/', icon: Squares2X2Icon },
  { name: 'Transactions', path: '/transactions', icon: ReceiptPercentIcon },
  { name: 'Budget', path: '/budget', icon: ChartPieIcon },
  { name: 'Predictions', path: '/predictions', icon: ArrowTrendingUpIcon },
  { name: 'Settings', path: '/settings', icon: Cog6ToothIcon },
];

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'DG';

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-5 select-none">
      <div>
        {/* Brand Header */}
        <div className="px-2 py-3 mb-6">
          <BrandLogo size="md" />
        </div>

        {/* Clean Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#F4F4F2] text-[#0A0A0A] font-semibold'
                      : 'text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F8]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 stroke-[1.75] ${
                        isActive ? 'text-[#0A0A0A]' : 'text-[#737373]'
                      }`}
                    />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Area at Bottom */}
      <div className="pt-4 border-t border-[#E5E5E3] space-y-3">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#F4F4F2] border border-[#E5E5E3] flex items-center justify-center text-xs font-bold text-[#0A0A0A] flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0A0A0A] truncate">
                {user?.name || 'Demo Guest'}
              </p>
              <p className="text-[11px] text-[#737373] truncate">
                {user?.email || 'guest@finsight.local'}
              </p>
            </div>
          </div>
          <ChevronDownIcon className="w-3.5 h-3.5 text-[#737373] flex-shrink-0" />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#737373] hover:text-[#DC2626] hover:bg-[#F9F9F8] rounded-md transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4 stroke-[1.75]" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex text-[#0A0A0A]">
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-[#FFFFFF] border-r border-[#E5E5E3] h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#FFFFFF] border-r border-[#E5E5E3] transform transition-transform duration-200 ease-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-md text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F4F4F2]"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
        {/* Mobile Top Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#FFFFFF] border-b border-[#E5E5E3] sticky top-0 z-30">
          <BrandLogo size="sm" />
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-[#0A0A0A] hover:bg-[#F4F4F2]"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;