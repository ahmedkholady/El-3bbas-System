import React from 'react';
import { Menu, LogOut, Bell } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ toggleSidebar }) => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 shadow-sm z-10">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-700 md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md p-1"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="hidden md:block text-xl font-semibold tracking-tight text-slate-800">
          لوحة التحكم
        </span>
      </div>

      <div className="flex items-center space-x-4 space-x-reverse">
        <div className="relative group">
          <button className="p-2 text-slate-400 hover:text-primary-600 relative transition-all duration-200 hover:bg-primary-50 rounded-full">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
          </button>
          
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 p-4 transform origin-top-left scale-95 group-hover:scale-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">التنبيهات الأخيرة</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 space-x-reverse p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 shrink-0 uppercase text-xs font-bold">A</div>
                <div>
                  <p className="text-xs text-slate-800 font-medium">مرحباً بك في نظام العباس ستور</p>
                  <p className="text-[10px] text-slate-400 mt-1">منذ قليل</p>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 text-[11px] font-bold text-primary-600 hover:underline text-center">مشاهدة كافة التنبيهات</button>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 space-x-reverse text-sm font-bold text-slate-600 hover:text-red-600 transition-all duration-200 px-4 py-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100"
        >
          <span>خروج</span>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
