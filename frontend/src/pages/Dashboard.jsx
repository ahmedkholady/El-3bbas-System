import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore';
import { TrendingUp, DollarSign, Activity, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/api/sales/dashboard');
        setStats(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  // Employee View
  if (user?.role === 'employee') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">مرحباً بك يا {user.name}</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          أنت مسجل كموظف مبيعات. يمكنك الانتقال إلى قسم المنتجات لاستعراض المخزون أو إلى المبيعات لإنشاء فاتورة جديدة.
        </p>
      </div>
    );
  }

  // Use chart data from stats or empty array
  const chartData = stats?.chartData || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">نظرة عامة</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="مبيعات اليوم"
          value={`$${stats?.daily?.totalRevenue?.toLocaleString() || 0}`}
          subtitle={`${stats?.daily?.count || 0} عملية بيع`}
          icon={<Activity className="w-6 h-6 text-primary-500" />}
          color="bg-primary-50 text-primary-600"
        />
        <StatCard
          title="مبيعات الشهر"
          value={`$${stats?.monthly?.totalRevenue?.toLocaleString() || 0}`}
          subtitle={`${stats?.monthly?.count || 0} عملية بيع`}
          icon={<TrendingUp className="w-6 h-6 text-emerald-500" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="إجمالي الإيرادات"
          value={`$${stats?.totalRevenue?.toLocaleString() || 0}`}
          subtitle="منذ البداية"
          icon={<DollarSign className="w-6 h-6 text-indigo-500" />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="إجمالي الأرباح"
          value={`$${stats?.totalProfit?.toLocaleString() || 0}`}
          subtitle="الربح الصافي"
          icon={<Package className="w-6 h-6 text-purple-500" />}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">إجمالي المبيعات (آخر 7 أيام)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Categories or Recent Sales List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">أحدث المبيعات الناجحة</h3>
            <button className="text-xs font-bold text-primary-600 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto">
            {stats?.recentSales?.length > 0 ? (
              stats.recentSales.map((sale, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 ml-3 font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{sale.productName}</p>
                      <p className="text-xs text-slate-500">{new Date(sale.date).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-emerald-600">${sale.totalPrice}</p>
                    <p className="text-xs text-slate-500">{sale.quantity} قطعة</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <CheckCircle className="w-12 h-12 mb-2 text-slate-200" />
                <p>لا توجد مبيعات حديثة لعرضها</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock AI Warnings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <AlertTriangle className="w-5 h-5 text-amber-500 ml-2" />
              نواقص المخزن
            </h3>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
              {stats?.lowStockProducts?.length || 0}
            </span>
          </div>
          <div className="p-0 flex-1 overflow-y-auto">
            {stats?.lowStockProducts?.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {stats.lowStockProducts.map((prod) => (
                  <li key={prod._id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{prod.name}</p>
                      <p className="text-xs text-slate-500">{prod.brand}</p>
                    </div>
                    <div className="text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        {prod.quantity} قطعة
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <Package className="w-12 h-12 mb-3 text-slate-200" />
                <p>لا يوجد منتجات منخفضة الكمية</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-extrabold text-slate-800">{value}</h4>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
    {subtitle && (
      <div className="mt-4 text-sm text-slate-500">
        <span className="font-medium text-slate-600">{subtitle}</span>
      </div>
    )}
  </div>
);

export default Dashboard;
