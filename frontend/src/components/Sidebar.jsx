import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, ShoppingCart, Settings } from 'lucide-react';
import useAuthStore from '../store/authStore';
import clsx from 'clsx';

const Sidebar = ({ isOpen, closeSidebar }) => {
  const { user } = useAuthStore();

  const links = [
    { name: 'لوحة التحكم', path: '/', icon: LayoutDashboard },
    { name: 'المنتجات', path: '/products', icon: ShoppingBag },
    { name: 'المبيعات', path: '/sales', icon: ShoppingCart },
    // Only Admin can see settings
    ...(user?.role === 'admin' ? [{ name: 'الإعدادات', path: '/settings', icon: Settings }] : []),
  ];

  return (
    <aside className={clsx(
      "fixed inset-y-0 right-0 z-30 w-64 bg-dark-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col shadow-2xl",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="h-20 flex flex-col items-center justify-center border-b border-dark-800 py-4">
        <div className="flex items-center space-x-2 space-x-reverse mb-1">
          <img src="/logo.png" alt="العباس ستور" className="h-8 w-auto" onError={(e) => e.target.style.display = 'none'} />
          <h1 className="text-xl font-bold text-primary-500 tracking-tight">العباس ستور</h1>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-dark-800 hover:text-white'
                )
              }
            >
              <Icon className="w-5 h-5 ml-3" />
              {link.name}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-dark-800">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg">
            {user?.name?.charAt(0)}
          </div>
          <div className="mr-3">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role === 'admin' ? 'مدير' : 'موظف'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
