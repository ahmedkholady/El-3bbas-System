import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { ShoppingCart, Plus, Calendar, CheckCircle } from 'lucide-react';
import io from 'socket.io-client';

const ENDPOINT = 'https://el-3bbas-system-production.up.railway.app';
let socket;

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // POS State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    socket = io(ENDPOINT);
    
    socket.on('new-sale', (sale) => {
      setNotifications((prev) => [{ type: 'sale', data: sale }, ...prev]);
      setSales((prev) => [sale, ...prev]);
    });

    socket.on('low-stock', (product) => {
      setNotifications((prev) => [{ type: 'warning', data: product }, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodsRes, salesRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/sales')
        ]);
        setProducts(prodsRes.data);
        setSales(salesRes.data);
      } catch (error) {
        console.error('Error fetching data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [notifications]); // Re-fetch products to update stock quantities safely

  const handleProductSelect = (id) => {
    setSelectedProduct(id);
    const prod = products.find(p => p._id === id);
    if (prod) {
      setCustomPrice(prod.sellingPrice);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) return;
    try {
      await api.post('/api/sales', { 
        product: selectedProduct, 
        quantity,
        totalPrice: customPrice * quantity // Send negotiated price
      });
      setSelectedProduct('');
      setQuantity(1);
      setCustomPrice(0);
      setSearchTerm('');
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing sale');
    }
  };

  const totalPrice = customPrice * quantity;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* POS Checkout Panel */}
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center mb-6">
            <ShoppingCart className="w-6 h-6 text-primary-600 ml-2" />
            <h2 className="text-xl font-bold text-slate-800">فاتورة جديدة</h2>
          </div>

          <form onSubmit={handleCreateSale} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">اختر المنتج</label>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن منتج (الاسم أو الماركة)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full px-4 py-2.5 text-sm border-slate-300 rounded-xl border bg-slate-50 focus:ring-primary-500 focus:border-primary-500 mb-2 shadow-sm transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                    type="button"
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                required
                value={selectedProduct}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-slate-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-xl border bg-white shadow-sm"
              >
                <option value="" disabled>-- اضغط للاختيار من النتائج --</option>
                {products
                  .filter(p => 
                    p.quantity > 0 && 
                    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} | {p.brand} (${p.sellingPrice})
                    </option>
                  ))}
                {products.filter(p => p.quantity > 0 && (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase()))).length === 0 && (
                  <option disabled>لا توجد منتجات تطابق البحث</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">سعر القطعة (قابل للتعديل)</label>
                <input
                  type="number"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-slate-300 rounded-xl py-2.5 border px-3 bg-primary-50 border-primary-100 font-bold text-primary-800"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الكمية</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-slate-300 rounded-xl py-2.5 border px-3"
                />
              </div>
            </div>

            <div className="py-4 border-t border-b border-slate-100 my-4 flex justify-between items-center bg-slate-50 px-4 rounded-xl">
              <span className="text-slate-600 font-bold">الإجمالي النهائي:</span>
              <span className="text-3xl font-extrabold text-slate-900">${totalPrice.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={!selectedProduct || quantity <= 0}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
            >
              تأكيد البيع
            </button>
          </form>
        </div>

        {/* Realtime Notifications */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            إشعارات حية (Socket.io)
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h2>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">لا توجد إشعارات بعد</p>
            ) : (
              notifications.map((notif, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm border-l-4 ${notif.type === 'sale' ? 'bg-primary-50 border-primary-500 text-primary-800' : 'bg-red-50 border-red-500 text-red-800'}`}>
                  {notif.type === 'sale' ? (
                    <div>تم بيع <span className="font-bold">{notif.data.quantity}</span> من <span className="font-bold">{notif.data.product?.name}</span> بواسطة {notif.data.user?.name}</div>
                  ) : (
                    <div>تحذير مخزون منخفض: المنتج <span className="font-bold">{notif.data.name}</span>เหลือ {notif.data.quantity} فقط!</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sales History Table */}
      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Calendar className="w-5 h-5 ml-2 text-slate-500" />
            سجل المبيعات
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">رقم الفاتورة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">المنتج</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الكمية</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الإجمالي</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الموظف</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">التاريخ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-500">جاري التحميل...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-500">لا يوجد مبيعات حتى الآن</td></tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">#{sale._id.slice(-6)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{sale.product?.name || 'منتج محذوف'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{sale.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">${sale.totalPrice}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{sale.user?.name || 'مستخدم غير معروف'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500" dir="ltr">
                      {new Date(sale.date).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
