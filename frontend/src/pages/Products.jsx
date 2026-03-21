import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';

const Products = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '', brand: '', sellingPrice: '', purchasePrice: '', quantity: '', category: 'عام'
  });

  const fetchProducts = async (keyword = '', category = '', showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get(`/api/products?keyword=${keyword}&category=${category}`);
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    fetchProducts(val, '', false); // Fast fetch without loading overlay
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        brand: product.brand,
        sellingPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        category: product.category || 'عام',
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', brand: '', sellingPrice: '', purchasePrice: '', quantity: '', category: 'عام' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/api/products/${editingProduct._id}`, formData);
      } else {
        await api.post('/api/products', formData);
      }
      setIsModalOpen(false);
      fetchProducts(searchTerm);
    } catch (error) {
      console.error('Failed to save product', error);
      alert('حدث خطأ أثناء حفظ المنتج');
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/products/${id}`);
      await fetchProducts(searchTerm, '', false);
      setDeleteConfirmId(null);
      // Removed alert for smoother experience, maybe add a toast later
    } catch (error) {
      console.error('Failed to delete product', error);
      alert('❌ فشل الحذف: ' + (error.response?.data?.message || 'خطأ غير معروف'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد الحذف</h3>
            <p className="text-slate-600 mb-6">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition"
              >
                تراجع
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition"
              >
                حذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">إدارة المنتجات</h1>
        
        {user?.role === 'admin' && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2.5 bg-primary-600 font-medium text-white rounded-lg shadow-sm hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة منتج
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-sm">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="البحث عن منتج..."
              className="block w-full pr-10 pl-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 whitespace-nowrap">التصنيف:</span>
            <select 
              className="block w-full pl-3 pr-10 py-2 border-slate-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-white"
              onChange={(e) => fetchProducts(searchTerm, e.target.value)}
            >
              <option value="">الكل</option>
              {[...new Set(products.map(p => p.category))].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">اسم المنتج</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">التصنيف</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الماركة</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الكمية</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">سعر البيع</th>
                {user?.role === 'admin' && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">سعر الشراء</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">الإجراءات</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-10 text-center text-slate-500">جاري التحميل...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-10 text-center text-slate-500">لا يوجد منتجات</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-bold">{product.category || 'عام'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{product.brand}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.quantity <= 5 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-bold">${product.sellingPrice}</td>
                    {user?.role === 'admin' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${product.purchasePrice}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium space-x-3 space-x-reverse">
                          <button onClick={() => handleOpenModal(product)} className="text-primary-600 hover:text-primary-900 p-1 hover:bg-primary-50 rounded">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => setDeleteConfirmId(product._id)} className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-xl text-right overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full" dir="rtl">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-bold text-slate-900" id="modal-title">
                  {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500 focus:outline-none">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">اسم المنتج</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الماركة</label>
                  <input type="text" required value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">سعر البيع</label>
                    <input type="number" required value={formData.sellingPrice} onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})} className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">سعر الشراء</label>
                    <input type="number" required value={formData.purchasePrice} onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})} className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">التصنيف (القسم)</label>
                  <input type="text" required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="مثال: جلابية، عطور..." className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الكمية</label>
                  <input type="number" required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md py-2 border px-3" />
                </div>
                <div className="pt-4 flex items-center justify-end space-x-3 space-x-reverse">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none">
                    إلغاء
                  </button>
                  <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none">
                    حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
