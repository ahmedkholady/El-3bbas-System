import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore';
import {
  TrendingUp,
  DollarSign,
  Activity,
  Package,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(5);
  const [expandedBrands, setExpandedBrands] = useState(new Set());

  const fetchStats = async (customThreshold = threshold) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/sales/dashboard?threshold=${customThreshold}`);
      setStats(data);
      // Automatically expand all brands that have shortages for immediate visibility
      if (Array.isArray(data.lowStockByBrand)) {
        setExpandedBrands(new Set(data.lowStockByBrand.map((b) => b.brand)));
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard stats', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats(threshold);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleThresholdChange = (newThreshold) => {
    setThreshold(newThreshold);
    fetchStats(newThreshold);
  };

  const toggleBrandExpand = (brandName) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandName)) {
        next.delete(brandName);
      } else {
        next.add(brandName);
      }
      return next;
    });
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Employee View
  if (user?.role === 'employee') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
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

  const chartData = stats?.chartData || [];
  const lowStockBrands = stats?.lowStockByBrand || [];
  const totalLowStockItems = stats?.lowStockProducts?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">نظرة عامة على المتجر</h1>
          <p className="text-xs text-slate-500 mt-1">مؤشرات الأداء اليومية، الأرباح، وحالة المخزون والنواقص</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="صافي مبيعات اليوم"
          value={`$${stats?.daily?.totalRevenue?.toLocaleString() || 0}`}
          subtitle={`${stats?.daily?.count || 0} عملية بيع ${
            stats?.daily?.refundAmount > 0 ? `(مرتجعات: $${stats.daily.refundAmount})` : ''
          }`}
          icon={<Activity className="w-6 h-6 text-primary-500" />}
          color="bg-primary-50 text-primary-600"
        />
        <StatCard
          title="صافي مبيعات الشهر"
          value={`$${stats?.monthly?.totalRevenue?.toLocaleString() || 0}`}
          subtitle={`${stats?.monthly?.count || 0} عملية بيع`}
          icon={<TrendingUp className="w-6 h-6 text-emerald-500" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="إجمالي الإيرادات (الصافي)"
          value={`$${stats?.totalRevenue?.toLocaleString() || 0}`}
          subtitle={stats?.totalRefunds > 0 ? `صافي بعد مرتجعات: $${stats.totalRefunds}` : 'منذ البداية'}
          icon={<DollarSign className="w-6 h-6 text-indigo-500" />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="إجمالي الأرباح الصافية"
          value={`$${stats?.totalProfit?.toLocaleString() || 0}`}
          subtitle="الأرباح الصافية بعد خصم التكلفة والمرتجعات"
          icon={<Package className="w-6 h-6 text-purple-500" />}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">صافي المبيعات اليومية (آخر 7 أيام)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales List */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">أحدث عمليات البيع</h3>
            <span className="text-xs text-slate-400">آخر 10 عمليات</span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {stats?.recentSales?.length > 0 ? (
              stats.recentSales.map((sale, idx) => (
                <div
                  key={sale._id || idx}
                  className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">{sale.productName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {sale.variantColor && (
                        <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          {sale.variantColor}
                        </span>
                      )}
                      {sale.variantSize && (
                        <span className="text-[11px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-bold">
                          {sale.variantSize}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(sale.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-emerald-600">${sale.totalPrice}</p>
                    <p className="text-xs text-slate-500">{sale.quantity} قطعة</p>
                    {sale.returnStatus !== 'none' && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        مرتجع {sale.returnedQuantity}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <CheckCircle className="w-12 h-12 mb-2 text-slate-200" />
                <p>لا توجد مبيعات حديثة</p>
              </div>
            )}
          </div>
        </div>

        {/* Improved Low Stock Panel Organized by Brand */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {/* Header with Threshold Selector */}
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 ml-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">نواقص المخزن (حسب الماركة والمتغير)</h3>
                <p className="text-xs text-slate-500">
                  إجمالي المتغيرات الناقصة:{' '}
                  <span className="font-bold text-red-600">{totalLowStockItems}</span> مقاس/لون
                </p>
              </div>
            </div>

            {/* Threshold Selector Control */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">حد النواقص:</span>
              <select
                value={threshold}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
              >
                <option value={3}>أقل من 3 قطع</option>
                <option value={5}>أقل من 5 قطع (افتراضي)</option>
                <option value={10}>أقل من 10 قطع</option>
                <option value={15}>أقل من 15 قطعة</option>
                <option value={20}>أقل من 20 قطعة</option>
              </select>
            </div>
          </div>

          {/* Grouped Brand Accordion List */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[500px] space-y-3">
            {lowStockBrands.length > 0 ? (
              lowStockBrands.map((brandGroup) => {
                const isBrandExpanded = expandedBrands.has(brandGroup.brand);

                return (
                  <div
                    key={brandGroup.brand}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition hover:border-slate-300"
                  >
                    {/* Brand Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleBrandExpand(brandGroup.brand)}
                      className="w-full p-3.5 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between text-right transition"
                    >
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-slate-900 ml-2">
                          ماركة: {brandGroup.brand}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          {brandGroup.totalShortages} نقص
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-slate-500">
                        <span className="ml-1">{isBrandExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
                        {isBrandExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Brand Items Breakdown */}
                    {isBrandExpanded && (
                      <div className="p-3 border-t border-slate-100 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                          <thead>
                            <tr className="text-slate-500 font-bold">
                              <th className="py-2 text-right">اسم المنتج</th>
                              <th className="py-2 text-right">القسم</th>
                              <th className="py-2 text-right">اللون</th>
                              <th className="py-2 text-right">المقاس الكامل</th>
                              <th className="py-2 text-right">الكمية المتبقية</th>
                              <th className="py-2 text-right">الحد المطبق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {brandGroup.items.map((item) => (
                              <tr key={item._id} className="hover:bg-slate-50/70">
                                <td className="py-2 font-bold text-slate-800">{item.name}</td>
                                <td className="py-2 text-slate-500">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    {item.category || 'عام'}
                                  </span>
                                </td>
                                <td className="py-2 text-slate-700 font-medium">
                                  {item.color || 'عام'}
                                </td>
                                <td className="py-2">
                                  <span className="font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                                    {item.size || 'عادي'}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <span className="inline-block px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-800">
                                    {item.quantity} قطعة
                                  </span>
                                </td>
                                <td className="py-2 text-slate-400 font-medium">
                                  {item.threshold} قطع
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center">
                <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" />
                <p className="font-bold text-slate-700">المخزون بحالة ممتازة!</p>
                <p className="text-xs text-slate-400 mt-1">
                  لا توجد أي منتجات أو مقاسات أقل من حد النواقص المحدد ({threshold} قطع)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon, color }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</h4>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>{icon}</div>
    </div>
    {subtitle && (
      <div className="mt-3 text-xs text-slate-500">
        <span>{subtitle}</span>
      </div>
    )}
  </div>
);

export default Dashboard;
