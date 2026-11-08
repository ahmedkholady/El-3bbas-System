import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api.js';
import { ShoppingCart, Calendar, CheckCircle, RotateCcw, History, AlertCircle, Layers, Loader2, X } from 'lucide-react';
import io from 'socket.io-client';

const ENDPOINT = import.meta.env.VITE_API_URL || 'https://el-3bbas-system-production.up.railway.app';
let socket;

// Custom hook to synchronize top and bottom horizontal scrollbars for wide data tables
const useSynchronizedHorizontalScroll = (activeTab, data, loading) => {
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [showTopScroll, setShowTopScroll] = useState(false);
  const syncingRef = useRef(null); // 'top' | 'bottom' | null
  const rAFRef = useRef(null);

  const handleTopScroll = useCallback(() => {
    if (syncingRef.current === 'bottom') return;
    if (!topScrollRef.current || !bottomScrollRef.current) return;
    if (Math.abs(bottomScrollRef.current.scrollLeft - topScrollRef.current.scrollLeft) < 1) return;

    syncingRef.current = 'top';
    bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;

    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    rAFRef.current = requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (syncingRef.current === 'top') return;
    if (!topScrollRef.current || !bottomScrollRef.current) return;
    if (Math.abs(topScrollRef.current.scrollLeft - bottomScrollRef.current.scrollLeft) < 1) return;

    syncingRef.current = 'bottom';
    topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;

    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    rAFRef.current = requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  useEffect(() => {
    const updateScrollWidth = () => {
      if (bottomScrollRef.current) {
        const sw = bottomScrollRef.current.scrollWidth;
        const cw = bottomScrollRef.current.clientWidth;
        setScrollWidth(sw);
        setShowTopScroll(sw > cw);
      }
    };

    updateScrollWidth();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && bottomScrollRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScrollWidth();
      });
      resizeObserver.observe(bottomScrollRef.current);
      if (tableRef.current) {
        resizeObserver.observe(tableRef.current);
      }
    }

    window.addEventListener('resize', updateScrollWidth);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [activeTab, data, loading]);

  useEffect(() => {
    if (showTopScroll && topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  }, [showTopScroll, scrollWidth]);

  useEffect(() => {
    return () => {
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    };
  }, []);

  return {
    topScrollRef,
    bottomScrollRef,
    tableRef,
    scrollWidth,
    showTopScroll,
    handleTopScroll,
    handleBottomScroll,
  };
};

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'returns'

  // POS State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState(0);
  const [isSelling, setIsSelling] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Return Modal State
  const [returnModalSale, setReturnModalSale] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnCondition, setReturnCondition] = useState('resalable'); // 'resalable' | 'damaged'
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  // Synchronized horizontal scroll for sales and returns tables
  const salesScroll = useSynchronizedHorizontalScroll(activeTab, sales, loading);
  const returnsScroll = useSynchronizedHorizontalScroll(activeTab, returns, loading);

  useEffect(() => {
    socket = io(ENDPOINT);

    socket.on('new-sale', (sale) => {
      setNotifications((prev) => [{ type: 'sale', data: sale }, ...prev]);
      setSales((prev) => [sale, ...prev]);
    });

    socket.on('low-stock', (product) => {
      setNotifications((prev) => [{ type: 'warning', data: product }, ...prev]);
    });

    socket.on('sale-returned', () => {
      // Refresh data on live return
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [prodsRes, salesRes, returnsRes] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/sales'),
        api.get('/api/sales/returns'),
      ]);
      setProducts(prodsRes.data);
      setSales(salesRes.data);
      setReturns(returnsRes.data);
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [notifications]);

  const handleProductSelect = (id) => {
    setSelectedProduct(id);
    setSelectedVariantId('');
    const prod = products.find((p) => p._id === id);
    if (!prod) return;

    if (prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0) {
      // Find first ACTIVE variant with available stock (quantity > 0)
      const activeVariants = prod.variants.filter((v) => !v.isArchived);
      const availableVariant = activeVariants.find((v) => v.quantity > 0);
      if (availableVariant) {
        setSelectedVariantId(availableVariant._id);
        setCustomPrice(availableVariant.sellingPrice !== undefined ? availableVariant.sellingPrice : prod.sellingPrice);
      }
    } else {
      setCustomPrice(prod.sellingPrice);
    }
    setQuantity(1);
  };

  const handleVariantSelect = (variantId) => {
    setSelectedVariantId(variantId);
    const prod = products.find((p) => p._id === selectedProduct);
    if (prod) {
      const variant = prod.variants.find((v) => v._id === variantId);
      if (variant) {
        setCustomPrice(variant.sellingPrice !== undefined ? variant.sellingPrice : prod.sellingPrice);
      }
    }
    setQuantity(1);
  };

  const currentProductObj = products.find((p) => p._id === selectedProduct);
  const currentVariantObj = currentProductObj?.hasVariants
    ? currentProductObj.variants.find((v) => v._id === selectedVariantId)
    : null;

  const maxAvailableStock = currentVariantObj
    ? currentVariantObj.quantity
    : (currentProductObj ? currentProductObj.quantity : 0);

  const handleCreateSale = async (e) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0 || isSelling) return;

    if (currentProductObj?.hasVariants && !selectedVariantId) {
      alert('يرجى تحديد المقاس واللون المطلوب بيعه');
      return;
    }

    if (quantity > maxAvailableStock) {
      alert(`الكمية المطلوبة (${quantity}) أكبر من المتوفر في المخزن (${maxAvailableStock})`);
      return;
    }

    setIsSelling(true);
    try {
      await api.post('/api/sales', {
        product: selectedProduct,
        variantId: selectedVariantId || undefined,
        quantity,
        totalPrice: customPrice * quantity,
      });

      setSelectedProduct('');
      setSelectedVariantId('');
      setQuantity(1);
      setCustomPrice(0);
      setSearchTerm('');
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'حدث خطأ أثناء إتمام عملية البيع');
    } finally {
      setIsSelling(false);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (sale) => {
    const remainingToReturn = sale.quantity - (sale.returnedQuantity || 0);
    setReturnModalSale(sale);
    setReturnQuantity(Math.min(1, remainingToReturn));
    setReturnCondition('resalable');
    setReturnReason('');
    setReturnError('');
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!returnModalSale || isSubmittingReturn) return;

    const remainingToReturn = returnModalSale.quantity - (returnModalSale.returnedQuantity || 0);
    if (returnQuantity <= 0 || returnQuantity > remainingToReturn) {
      setReturnError(`الكمية المرتجعة يجب أن تكون بين 1 و ${remainingToReturn}`);
      return;
    }

    setIsSubmittingReturn(true);
    setReturnError('');

    try {
      await api.post(`/api/sales/${returnModalSale._id}/return`, {
        quantity: returnQuantity,
        condition: returnCondition,
        reason: returnReason,
      });

      setReturnModalSale(null);
      await fetchData();
    } catch (error) {
      console.error('Failed to process return', error);
      setReturnError(error.response?.data?.message || 'فشل تسجيل المرتجع');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const totalPrice = customPrice * quantity;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Return Modal */}
      {returnModalSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity"
              onClick={() => !isSubmittingReturn && setReturnModalSale(null)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div
              className="inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full"
              dir="rtl"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 ml-2.5">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">تسجيل مرتجع فاتورة بيع</h3>
                </div>
                <button
                  onClick={() => !isSubmittingReturn && setReturnModalSale(null)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {returnError && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 ml-2 shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}

              <form onSubmit={handleProcessReturn} className="p-6 space-y-4">
                {/* Sale Details Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الفاتورة:</span>
                    <span className="font-mono font-bold text-slate-800">#{returnModalSale._id.slice(-6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المنتج:</span>
                    <span className="font-bold text-slate-800">{returnModalSale.product?.name}</span>
                  </div>
                  {(returnModalSale.variantColor || returnModalSale.variantSize) && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">المقاس واللون:</span>
                      <span className="font-bold text-primary-700">
                        {returnModalSale.variantColor} | {returnModalSale.variantSize}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">سعر بيع القطعة:</span>
                    <span className="font-bold text-slate-800">
                      ${(returnModalSale.sellingPrice || (returnModalSale.totalPrice / returnModalSale.quantity)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الكمية المباعة الأصلية:</span>
                    <span className="font-bold text-slate-800">{returnModalSale.quantity} قطعة</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                    <span className="text-slate-700">الكمية المتبقية القابلة للإرجاع:</span>
                    <span className="text-primary-700">
                      {returnModalSale.quantity - (returnModalSale.returnedQuantity || 0)} قطعة
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المراد إرجاعها *</label>
                  <input
                    type="number"
                    min="1"
                    max={returnModalSale.quantity - (returnModalSale.returnedQuantity || 0)}
                    required
                    value={returnQuantity}
                    onChange={(e) => setReturnQuantity(Number(e.target.value))}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Stock condition */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة القطعة المرتجعة *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer text-xs transition ${
                        returnCondition === 'resalable'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        <input
                          type="radio"
                          name="returnCondition"
                          value="resalable"
                          checked={returnCondition === 'resalable'}
                          onChange={() => setReturnCondition('resalable')}
                          className="ml-2 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>سليم وقابل للبيع</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        سيتم زيادة كمية المخزن المتاح للبيع تلقائياً
                      </span>
                    </label>

                    <label
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer text-xs transition ${
                        returnCondition === 'damaged'
                          ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        <input
                          type="radio"
                          name="returnCondition"
                          value="damaged"
                          checked={returnCondition === 'damaged'}
                          onChange={() => setReturnCondition('damaged')}
                          className="ml-2 text-red-600 focus:ring-red-500"
                        />
                        <span>تالف / غير قابل للبيع</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        لن يضاف للمخزون الصالح للبيع (يسجل كتالف)
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب المرتجع (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: مقاس غير مناسب، رغبة العميل..."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Refund Total Preview */}
                <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-700">إجمالي المبلغ المسترد للعميل:</span>
                  <span className="text-lg text-emerald-700">
                    $
                    {(
                      returnQuantity *
                      (returnModalSale.sellingPrice || (returnModalSale.totalPrice / returnModalSale.quantity))
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="pt-2 flex justify-end space-x-3 space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setReturnModalSale(null)}
                    disabled={isSubmittingReturn}
                    className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReturn}
                    className="px-6 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition flex items-center disabled:opacity-50"
                  >
                    {isSubmittingReturn ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري التسجيل...
                      </>
                    ) : (
                      'تأكيد تسجيل المرتجع'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* POS Checkout Panel */}
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center mb-6">
            <ShoppingCart className="w-6 h-6 text-primary-600 ml-2" />
            <h2 className="text-xl font-bold text-slate-800">فاتورة بيع جديدة</h2>
          </div>

          <form onSubmit={handleCreateSale} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">اختر المنتج أو الموديل</label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الماركة، أو المقاس..."
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
                className="mt-1 block w-full pl-3 pr-10 py-3 text-sm border-slate-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-xl border bg-white shadow-sm"
              >
                <option value="" disabled>
                  -- اضغط لاختيار المنتج --
                </option>
                {products
                  .filter((p) => {
                    const st = searchTerm.toLowerCase();
                    const matchesName = p.name.toLowerCase().includes(st);
                    const matchesBrand = p.brand.toLowerCase().includes(st);
                    const activeVariants =
                      p.hasVariants && Array.isArray(p.variants)
                        ? p.variants.filter((v) => !v.isArchived)
                        : [];
                    const hasSellableStock = p.hasVariants
                      ? activeVariants.some((v) => v.quantity > 0)
                      : p.quantity > 0;
                    const matchesVariant =
                      p.hasVariants &&
                      activeVariants.some(
                        (v) =>
                          (v.color && v.color.toLowerCase().includes(st)) ||
                          (v.size && v.size.toLowerCase().includes(st))
                      );
                    return hasSellableStock && (matchesName || matchesBrand || matchesVariant);
                  })
                  .map((p) => {
                    const activeCount =
                      p.hasVariants && Array.isArray(p.variants)
                        ? p.variants.filter((v) => !v.isArchived).length
                        : 0;
                    return (
                      <option key={p._id} value={p._id}>
                        {p.name} | {p.brand} ({p.hasVariants ? `${activeCount} مقاسات نشطة` : `$${p.sellingPrice}`})
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Variant Selector for Grouped Products */}
            {currentProductObj?.hasVariants && Array.isArray(currentProductObj.variants) && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center">
                  <Layers className="w-3.5 h-3.5 ml-1 text-primary-600" />
                  اختر المقاس واللون المطلوب بيعه:
                </label>
                <select
                  required
                  value={selectedVariantId}
                  onChange={(e) => handleVariantSelect(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="" disabled>
                    -- اختر المقاس واللون --
                  </option>
                  {currentProductObj.variants
                    .filter((v) => !v.isArchived)
                    .map((v) => (
                      <option key={v._id} value={v._id} disabled={v.quantity <= 0}>
                        {v.color ? `اللون: ${v.color}` : 'لون عام'} | المقاس: {v.size || 'عادي'} (المتوفر:{' '}
                        {v.quantity} قطعة)
                        {v.quantity <= 0 ? ' [نفذت الكمية]' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر القطعة (قابل للتعديل)</label>
                <input
                  type="number"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-slate-300 rounded-xl py-2.5 border px-3 bg-primary-50 border-primary-100 font-bold text-primary-800"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">الكمية</label>
                  {selectedProduct && (
                    <span className="text-[11px] text-slate-500 font-medium">المتاح: {maxAvailableStock}</span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={maxAvailableStock || 1}
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
              disabled={!selectedProduct || quantity <= 0 || isSelling || maxAvailableStock <= 0}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
            >
              {isSelling ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري تسجيل الفاتورة...
                </>
              ) : (
                'تأكيد البيع'
              )}
            </button>
          </form>
        </div>

        {/* Realtime Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            إشعارات حية (Socket.io)
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h2>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا توجد إشعارات جديدة</p>
            ) : (
              notifications.map((notif, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl text-xs border-r-4 ${
                    notif.type === 'sale'
                      ? 'bg-primary-50 border-primary-500 text-primary-800'
                      : 'bg-red-50 border-red-500 text-red-800'
                  }`}
                >
                  {notif.type === 'sale' ? (
                    <div>
                      تم بيع <span className="font-bold">{notif.data.quantity}</span> من{' '}
                      <span className="font-bold">{notif.data.product?.name}</span>
                      {notif.data.variantSize && ` (مقاس: ${notif.data.variantSize})`} بواسطة{' '}
                      {notif.data.user?.name}
                    </div>
                  ) : (
                    <div>
                      تحذير مخزون منخفض: <span className="font-bold">{notif.data.name}</span>
                      {notif.data.variantSize && ` (${notif.data.variantSize})`} متبقي{' '}
                      {notif.data.quantity} قطعة فقط!
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sales & Returns History Panel */}
      <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Navigation Tabs */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center ${
                activeTab === 'sales'
                  ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-4 h-4 ml-1.5" />
              سجل المبيعات ({sales.length})
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center ${
                activeTab === 'returns'
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <History className="w-4 h-4 ml-1.5" />
              سجل المرتجعات ({returns.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Sales History */}
        {activeTab === 'sales' && (
          <>
            {/* Top horizontal scrollbar synchronized with the sales table */}
            {salesScroll.showTopScroll && (
              <div
                ref={salesScroll.topScrollRef}
                onScroll={salesScroll.handleTopScroll}
                className="overflow-x-auto overflow-y-hidden bg-slate-50/75 border-b border-slate-200"
                style={{ minHeight: '12px' }}
                aria-label="شريط التمرير الأفقي العلوي لجدول المبيعات"
              >
                <div style={{ width: `${salesScroll.scrollWidth}px`, height: '1px' }} />
              </div>
            )}
            <div
              ref={salesScroll.bottomScrollRef}
              onScroll={salesScroll.handleBottomScroll}
              className="overflow-x-auto flex-1"
            >
              <table ref={salesScroll.tableRef} className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">المنتج والموديل</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">المقاس / اللون</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">الكمية</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">الإجمالي</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">الموظف</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">التاريخ</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">إجراء المرتجع</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                        جاري التحميل...
                      </td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                        لا توجد مبيعات مسجلة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => {
                      const remainingReturnable = sale.quantity - (sale.returnedQuantity || 0);

                      return (
                        <tr key={sale._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                            #{sale._id.slice(-6)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                            {sale.product?.name || 'منتج محذوف'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sale.variantSize || sale.variantColor ? (
                              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded">
                                {sale.variantColor && `${sale.variantColor} - `}
                                {sale.variantSize}
                              </span>
                            ) : (
                              <span className="text-slate-400">عادي</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800">{sale.quantity}</span>
                            {sale.returnedQuantity > 0 && (
                              <span className="mr-1 text-[10px] text-amber-600 font-bold">
                                (مرتجع: {sale.returnedQuantity})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-emerald-600">
                            ${sale.totalPrice}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                            {sale.user?.name || 'مستخدم غير معروف'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500" dir="ltr">
                            {new Date(sale.date).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-left">
                            {remainingReturnable > 0 ? (
                              <button
                                onClick={() => handleOpenReturnModal(sale)}
                                className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition flex items-center"
                              >
                                <RotateCcw className="w-3.5 h-3.5 ml-1" />
                                مرتجع
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">مرتجع كامل</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Tab 2: Returns Audit History */}
        {activeTab === 'returns' && (
          <>
            {/* Top horizontal scrollbar synchronized with the returns table */}
            {returnsScroll.showTopScroll && (
              <div
                ref={returnsScroll.topScrollRef}
                onScroll={returnsScroll.handleTopScroll}
                className="overflow-x-auto overflow-y-hidden bg-slate-50/75 border-b border-slate-200"
                style={{ minHeight: '12px' }}
                aria-label="شريط التمرير الأفقي العلوي لجدول المرتجعات"
              >
                <div style={{ width: `${returnsScroll.scrollWidth}px`, height: '1px' }} />
              </div>
            )}
            <div
              ref={returnsScroll.bottomScrollRef}
              onScroll={returnsScroll.handleBottomScroll}
              className="overflow-x-auto flex-1"
            >
              <table ref={returnsScroll.tableRef} className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">رقم الإرجاع</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">المنتج</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">المقاس / اللون</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">الكمية المرتجعة</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">المبلغ المسترد</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">حالة القطعة</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">السبب</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">الموظف</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-10 text-center text-slate-500">
                        لا توجد عمليات مرتجع مسجلة
                      </td>
                    </tr>
                  ) : (
                    returns.map((ret) => (
                      <tr key={ret._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                          #{ret._id.slice(-6)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                          {ret.product?.name || 'منتج محذوف'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {ret.variantSize || ret.variantColor ? (
                            <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded">
                              {ret.variantColor && `${ret.variantColor} - `}
                              {ret.variantSize}
                            </span>
                          ) : (
                            <span className="text-slate-400">عادي</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-amber-700">
                          {ret.quantity} قطعة
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-red-600">
                          -${ret.refundAmount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              ret.condition === 'resalable'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {ret.condition === 'resalable' ? 'سليم (أعيد للمخزن)' : 'تالف / معيب'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {ret.reason || 'بدون سبب مسجل'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {ret.user?.name || 'مستخدم'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500" dir="ltr">
                          {new Date(ret.date || ret.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Sales;
