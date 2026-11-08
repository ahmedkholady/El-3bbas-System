import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import useAuthStore from '../store/authStore';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertCircle,
  Loader2,
  Minus,
  Check,
  Archive,
  RotateCcw,
} from 'lucide-react';

// Combine length + width into a single display/stored size string.
// Both are optional. Empty fields are omitted.
const buildSizeString = (length, width) => {
  const l = (length || '').trim();
  const w = (width || '').trim();
  if (l && w) return `${l} ${w}`;
  if (l) return l;
  if (w) return w;
  return '';
};

// Split a stored combined size back into { length, width } for editing.
// Heuristic: if the value has a space and the first token is numeric, split there.
// Otherwise, treat the entire string as width (letter-based).
const splitSizeString = (sizeStr) => {
  const s = (sizeStr || '').trim();
  if (!s) return { length: '', width: '' };
  const spaceIdx = s.indexOf(' ');
  if (spaceIdx > -1) {
    const first = s.slice(0, spaceIdx);
    const rest = s.slice(spaceIdx + 1).trim();
    if (/^\d+$/.test(first)) {
      return { length: first, width: rest };
    }
  }
  // Single token — treat as width if it's a letter-based size, length if purely numeric
  if (/^\d+$/.test(s)) return { length: s, width: '' };
  return { length: '', width: s };
};

const Products = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Main product info form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    sellingPrice: '',
    purchasePrice: '',
    category: 'عام',
    quantity: 0,
    hasVariants: false,
    lowStockThreshold: 5,
  });

  // Current variant entry fields
  const [variantInput, setVariantInput] = useState({
    length: '',
    width: '',
    color: '',
    quantity: 1,
    _id: null,
  });

  // Staged variants list
  const [stagedVariants, setStagedVariants] = useState([]);

  // Index of the staged variant currently being edited in-place (null = none)
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchProducts = useCallback(async (keyword = '', category = '', showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get(
        `/api/products?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`
      );
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    fetchProducts(val, selectedCategory, false);
  };

  const handleCategoryFilter = (cat) => {
    setSelectedCategory(cat);
    fetchProducts(searchTerm, cat, false);
  };

  const toggleExpand = (productId) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const resetVariantInput = () => {
    setVariantInput({ length: '', width: '', color: '', quantity: 1, _id: null });
    setEditingVariantIndex(null);
  };

  const handleOpenModal = (product = null) => {
    setErrorMessage('');
    setSuccessToast('');
    if (product) {
      const isVariant = Boolean(
        product.hasVariants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
      );

      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        brand: product.brand || '',
        sellingPrice: product.sellingPrice !== undefined ? product.sellingPrice : '',
        purchasePrice: product.purchasePrice !== undefined ? product.purchasePrice : '',
        category: product.category || 'عام',
        quantity: product.quantity !== undefined ? product.quantity : 0,
        hasVariants: isVariant,
        lowStockThreshold: product.lowStockThreshold !== undefined ? product.lowStockThreshold : 5,
      });

      // Populate staged variants ONLY for products that truly have variants
      if (isVariant) {
        setStagedVariants(
          product.variants.map((v) => {
            const { length, width } = splitSizeString(v.size);
            return {
              _id: v._id,
              length,
              width,
              color: v.color || '',
              quantity: v.quantity !== undefined ? v.quantity : 0,
              isArchived: Boolean(v.isArchived),
              sellingPrice: v.sellingPrice !== undefined ? v.sellingPrice : '',
              purchasePrice: v.purchasePrice !== undefined ? v.purchasePrice : '',
              sku: v.sku || '',
            };
          })
        );
      } else {
        // Simple product without variants — do NOT introduce fake variant rows!
        setStagedVariants([]);
      }
    } else {
      setEditingProduct(null);
      const defaultCategory =
        selectedCategory && selectedCategory.trim() !== '' ? selectedCategory : 'عام';
      setFormData({
        name: '',
        brand: '',
        sellingPrice: '',
        purchasePrice: '',
        category: defaultCategory,
        quantity: 1,
        hasVariants: false,
        lowStockThreshold: 5,
      });
      setStagedVariants([]);
    }
    resetVariantInput();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingProduct(null);
    setErrorMessage('');
    setSuccessToast('');
    setStagedVariants([]);
    resetVariantInput();
  };

  // Add the current variant input to the staged list (or merge if identical size+color)
  const handleAddVariant = () => {
    const size = buildSizeString(variantInput.length, variantInput.width);
    const color = (variantInput.color || '').trim();
    const qty = Math.floor(Number(variantInput.quantity));

    if (qty <= 0) {
      setErrorMessage('الكمية يجب أن تكون رقماً صحيحاً أكبر من الصفر');
      return;
    }
    setErrorMessage('');

    // Check for duplicate (same size + color combination in staged list)
    const existingIdx = stagedVariants.findIndex(
      (v) =>
        buildSizeString(v.length, v.width).toLowerCase() === size.toLowerCase() &&
        (v.color || '').trim().toLowerCase() === color.toLowerCase()
    );

    if (existingIdx > -1) {
      setStagedVariants((prev) => {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + qty };
        return updated;
      });
      setSuccessToast(`تمت إضافة ${qty} قطع إلى التركيبة الموجودة`);
    } else {
      setStagedVariants((prev) => [
        ...prev,
        {
          ...(variantInput._id ? { _id: variantInput._id } : {}),
          length: (variantInput.length || '').trim(),
          width: (variantInput.width || '').trim(),
          color,
          quantity: qty,
          isArchived: false,
        },
      ]);
      setSuccessToast('تمت إضافة مقاس/تركيبة جديدة');
    }

    resetVariantInput();
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleUpdateStagedQty = (index, delta) => {
    setStagedVariants((prev) => {
      const updated = [...prev];
      const current = updated[index];
      const newQty = (current.quantity || 0) + delta;
      // Saved variants: do NOT delete when reaching 0; keep minimum 0
      if (current._id) {
        updated[index] = { ...current, quantity: Math.max(0, newQty) };
        return updated;
      }
      // Unsaved staged variants: remove if decremented to 0 or below
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      updated[index] = { ...current, quantity: newQty };
      return updated;
    });
  };

  const handleStagedQtyDirectEdit = (index, rawVal) => {
    const val = Math.max(0, Math.floor(Number(rawVal)));
    setStagedVariants((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (!current._id && val <= 0) return prev.filter((_, i) => i !== index);
      updated[index] = { ...current, quantity: val };
      return updated;
    });
  };

  const handleToggleArchiveStagedVariant = (index) => {
    setStagedVariants((prev) => {
      const updated = [...prev];
      const current = updated[index];
      updated[index] = { ...current, isArchived: !current.isArchived };
      return updated;
    });
  };

  const handleRemoveStagedVariant = (index) => {
    // Prevent removing drafts while actively editing a saved variant in-place
    if (editingVariantIndex !== null && !stagedVariants[index]?._id) return;

    setStagedVariants((prev) => {
      const target = prev[index];
      // Saved variants: safely archive instead of destructive delete
      if (target?._id) {
        const updated = [...prev];
        updated[index] = { ...target, isArchived: true };
        return updated;
      }
      // Unsaved draft variants: can be removed cleanly from stage
      return prev.filter((_, i) => i !== index);
    });
  };

  // Edit a staged variant.
  // - Saved variants (v._id): load into input for editing WITHOUT removing from staged list.
  //   The index is remembered so "Apply" can update in-place, preserving _id and isArchived.
  // - Unsaved draft variants: pull from list into input (safe to remove, no DB record exists).
  const handleEditStagedVariant = (index) => {
    const target = stagedVariants[index];
    setVariantInput({
      length: target.length || '',
      width: target.width || '',
      color: target.color || '',
      quantity: target.quantity || 1,
      _id: target._id || null,
    });
    if (target._id) {
      // Saved variant: keep it in the staged list; remember which index we are editing
      setEditingVariantIndex(index);
    } else {
      // Unsaved draft: safe to remove while editing
      setEditingVariantIndex(null);
      setStagedVariants((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Apply edits back to a saved variant in-place, preserving _id, isArchived, and other data.
  // Prevents duplicates: if another staged entry already has the same size+color combo
  // (and it is NOT the entry being edited), the edit is rejected with an error.
  const handleApplyVariantEdit = () => {
    if (editingVariantIndex === null) return;
    const size = buildSizeString(variantInput.length, variantInput.width);
    const color = (variantInput.color || '').trim();
    const qty = Math.floor(Number(variantInput.quantity));

    if (qty < 0) {
      setErrorMessage('الكمية يجب أن تكون صفراً أو أكثر');
      return;
    }
    setErrorMessage('');

    // Duplicate check: reject if another entry (different index) has same size+color
    const duplicateIdx = stagedVariants.findIndex(
      (v, i) =>
        i !== editingVariantIndex &&
        buildSizeString(v.length, v.width).toLowerCase() === size.toLowerCase() &&
        (v.color || '').trim().toLowerCase() === color.toLowerCase()
    );
    if (duplicateIdx > -1) {
      setErrorMessage('توجد تركيبة مقاس/لون مطابقة بالفعل. عدّل الكمية هناك مباشرة أو اختر مقاساً أو لوناً مختلفاً.');
      return;
    }

    setStagedVariants((prev) => {
      const updated = [...prev];
      const current = updated[editingVariantIndex];
      // Preserve _id, isArchived, sellingPrice, purchasePrice, sku — only update editable fields
      updated[editingVariantIndex] = {
        ...current,
        length: (variantInput.length || '').trim(),
        width: (variantInput.width || '').trim(),
        color,
        quantity: qty,
      };
      return updated;
    });

    setSuccessToast('تم تحديث المقاس بنجاح');
    resetVariantInput(); // also clears editingVariantIndex
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const idempotencyKey = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      let payload;

      if (formData.hasVariants) {
        let finalVariants = [...stagedVariants];
        const pendingLength = (variantInput.length || '').trim();
        const pendingWidth = (variantInput.width || '').trim();
        const pendingColor = (variantInput.color || '').trim();
        const pendingSize = buildSizeString(pendingLength, pendingWidth);
        const pendingQty = Math.floor(Number(variantInput.quantity));

        // If user is currently editing a variant in-place when submitting, apply those edits first
        if (editingVariantIndex !== null) {
          if (editingVariantIndex >= 0 && editingVariantIndex < finalVariants.length) {
            const duplicateIdx = finalVariants.findIndex(
              (v, i) =>
                i !== editingVariantIndex &&
                buildSizeString(v.length, v.width).toLowerCase() === pendingSize.toLowerCase() &&
                (v.color || '').trim().toLowerCase() === pendingColor.toLowerCase()
            );
            if (duplicateIdx > -1) {
              setErrorMessage('توجد تركيبة مقاس/لون مطابقة بالفعل للمتغير الجاري تعديله.');
              setIsSubmitting(false);
              return;
            }
            finalVariants[editingVariantIndex] = {
              ...finalVariants[editingVariantIndex],
              length: pendingLength,
              width: pendingWidth,
              color: pendingColor,
              quantity: pendingQty >= 0 ? pendingQty : finalVariants[editingVariantIndex].quantity,
            };
          }
        } else if ((pendingSize || pendingColor) && pendingQty > 0) {
          // Auto-add pending variant ONLY if size or color was actually typed
          const existingIdx = finalVariants.findIndex(
            (v) =>
              buildSizeString(v.length, v.width).toLowerCase() === pendingSize.toLowerCase() &&
              (v.color || '').trim().toLowerCase() === pendingColor.toLowerCase()
          );
          if (existingIdx > -1) {
            finalVariants[existingIdx] = {
              ...finalVariants[existingIdx],
              quantity: finalVariants[existingIdx].quantity + pendingQty,
            };
          } else {
            finalVariants.push({
              ...(variantInput._id ? { _id: variantInput._id } : {}),
              length: pendingLength,
              width: pendingWidth,
              color: pendingColor,
              quantity: pendingQty,
            });
          }
        }

        if (finalVariants.length === 0) {
          setErrorMessage('يرجى إدخال مقاس وكمية واحدة على الأقل لهذا المنتج بمتغيرات.');
          setIsSubmitting(false);
          return;
        }

        const apiVariants = finalVariants.map((v) => ({
          ...(v._id ? { _id: v._id } : {}),
          color: v.color || '',
          size: buildSizeString(v.length, v.width),
          quantity: Number(v.quantity) || 0,
          isArchived: Boolean(v.isArchived),
          ...(v.sellingPrice !== undefined && v.sellingPrice !== '' ? { sellingPrice: Number(v.sellingPrice) } : {}),
          ...(v.purchasePrice !== undefined && v.purchasePrice !== '' ? { purchasePrice: Number(v.purchasePrice) } : {}),
          ...(v.sku ? { sku: (v.sku || '').trim() } : {}),
        }));

        const totalQuantity = apiVariants.reduce((sum, v) => sum + v.quantity, 0);

        payload = {
          name: formData.name.trim(),
          brand: formData.brand.trim(),
          category: (formData.category || 'عام').trim(),
          sellingPrice: Number(formData.sellingPrice),
          purchasePrice: Number(formData.purchasePrice),
          hasVariants: true,
          variants: apiVariants,
          quantity: totalQuantity,
          lowStockThreshold: Number(formData.lowStockThreshold) || 5,
          idempotencyKey,
        };
      } else {
        // Simple product — preserve simple schema, no variants
        const simpleQty = Number(formData.quantity);
        if (formData.quantity === '' || isNaN(simpleQty) || simpleQty < 0) {
          setErrorMessage('يرجى إدخال كمية مخزون صحيحة (صفر أو أكثر).');
          setIsSubmitting(false);
          return;
        }

        payload = {
          name: formData.name.trim(),
          brand: formData.brand.trim(),
          category: (formData.category || 'عام').trim(),
          sellingPrice: Number(formData.sellingPrice),
          purchasePrice: Number(formData.purchasePrice),
          hasVariants: false,
          variants: [],
          quantity: simpleQty,
          lowStockThreshold: Number(formData.lowStockThreshold) || 5,
          idempotencyKey,
        };
      }

      if (editingProduct) {
        await api.put(`/api/products/${editingProduct._id}`, payload);
      } else {
        await api.post('/api/products', payload);
      }

      setIsModalOpen(false);
      setStagedVariants([]);
      resetVariantInput();
      // Reset filters so the new product (and any new category) is immediately visible
      setSelectedCategory('');
      setSearchTerm('');
      fetchProducts('', '', false);
    } catch (error) {
      console.error('Failed to save product', error);
      setErrorMessage(
        error.response?.data?.message ||
          error.message ||
          'حدث خطأ أثناء حفظ المنتج، يرجى إعادة المحاولة.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/products/${id}`);
      await fetchProducts(searchTerm, selectedCategory, false);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete product', error);
      alert('❌ فشل الحذف: ' + (error.response?.data?.message || 'خطأ غير معروف'));
    }
  };

  const totalStagedPieces = stagedVariants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد الحذف</h3>
            <p className="text-slate-600 mb-6">
              هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">إدارة المنتجات والمخزون</h1>
          <p className="text-sm text-slate-500 mt-1">
            استعراض الموديلات، المقاسات والكميات حسب الماركة
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2.5 bg-primary-600 font-bold text-white rounded-xl shadow-sm hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة منتج جديد
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="البحث بالاسم، الماركة، أو المقاس (مثل: 58 XL، النور)..."
              className="block w-full pr-10 pl-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">التصنيف:</span>
            <select
              className="block w-full sm:w-48 pl-3 pr-8 py-2 border-slate-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-white"
              value={selectedCategory}
              onChange={(e) => handleCategoryFilter(e.target.value)}
            >
              <option value="">جميع الأقسام</option>
              {[...new Set(products.map((p) => p.category).filter(Boolean))].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  المنتج / الموديل
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  التصنيف
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  الماركة
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  المخزون / المقاسات
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  سعر البيع
                </th>
                {user?.role === 'admin' && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      سعر الشراء
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                      <span className="mr-3">جاري التحميل...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                    لا توجد منتجات تطابق البحث
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const hasVariants =
                    product.hasVariants &&
                    Array.isArray(product.variants) &&
                    product.variants.length > 0;
                  const isExpanded = expandedProductIds.has(product._id);
                  const isLowStock = product.quantity <= (product.lowStockThreshold || 5);

                  return (
                    <React.Fragment key={product._id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {hasVariants && (
                              <button
                                onClick={() => toggleExpand(product._id)}
                                className="ml-2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded hover:bg-slate-100"
                                title="عرض المقاسات"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <div>
                              <p className="text-sm font-bold text-slate-900">{product.name}</p>
                              {hasVariants && (
                                <span className="inline-flex items-center text-xs text-primary-600 font-medium mt-0.5">
                                  <Layers className="w-3 h-3 ml-1" />
                                  {(() => {
                                    const totalVar = product.variants.length;
                                    const archivedCount = product.variants.filter((v) => v.isArchived).length;
                                    if (archivedCount > 0) {
                                      return `${totalVar} مقاس/لون (${archivedCount} مؤرشف)`;
                                    }
                                    return `${totalVar} مقاس/لون`;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          <span className="bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                            {product.category || 'عام'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                          {product.brand}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isLowStock
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {product.quantity} قطعة
                            </span>
                            {isLowStock && (
                              <span className="text-[11px] text-red-600 font-medium">
                                مخزون منخفض
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-bold">
                          ${product.sellingPrice}
                        </td>
                        {user?.role === 'admin' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              ${product.purchasePrice}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium space-x-3 space-x-reverse">
                              <button
                                onClick={() => handleOpenModal(product)}
                                className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-primary-50 rounded-lg transition"
                                title="تعديل المنتج والمخزون"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(product._id)}
                                className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded-lg transition"
                                title="حذف المنتج"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>

                      {/* Expandable Variants Panel */}
                      {hasVariants && isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan="7" className="px-8 py-3">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-inner">
                              <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center">
                                <Layers className="w-3.5 h-3.5 ml-1 text-primary-600" />
                                تفاصيل مقاسات موديل: {product.name} — {product.brand}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-xs">
                                  <thead>
                                    <tr className="text-slate-500 font-bold">
                                      <th className="py-1.5 text-right">الحالة</th>
                                      <th className="py-1.5 text-right">اللون</th>
                                      <th className="py-1.5 text-right">المقاس</th>
                                      <th className="py-1.5 text-right">الكمية بالمخزن</th>
                                      <th className="py-1.5 text-right">سعر البيع</th>
                                      {user?.role === 'admin' && (
                                        <th className="py-1.5 text-right">سعر الشراء</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {product.variants.map((v) => (
                                      <tr
                                        key={v._id || `${v.color}_${v.size}`}
                                        className={`hover:bg-slate-50 ${v.isArchived ? 'bg-slate-50/60 opacity-80' : ''}`}
                                      >
                                        <td className="py-2">
                                          {v.isArchived ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                              مؤرشف
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              نشط
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 font-medium text-slate-800">
                                          {v.color || '—'}
                                        </td>
                                        <td className="py-2 font-bold text-primary-700">
                                          {v.size || '—'}
                                        </td>
                                        <td className="py-2">
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                              v.isArchived
                                                ? 'bg-slate-100 text-slate-700'
                                                : v.quantity <= (product.lowStockThreshold || 5)
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                            }`}
                                          >
                                            {v.quantity} قطعة
                                          </span>
                                        </td>
                                        <td className="py-2 font-medium text-slate-800">
                                          $
                                          {v.sellingPrice !== undefined
                                            ? v.sellingPrice
                                            : product.sellingPrice}
                                        </td>
                                        {user?.role === 'admin' && (
                                          <td className="py-2 text-slate-500">
                                            $
                                            {v.purchasePrice !== undefined
                                              ? v.purchasePrice
                                              : product.purchasePrice}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Creation / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity"
              onClick={handleCloseModal}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div
              className="inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-6 sm:align-middle sm:max-w-2xl w-full"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingProduct ? 'تعديل المنتج والمخزون' : 'إضافة منتج ومخزون جديد'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    أدخل بيانات الموديل ثم أضف المقاسات والكميات المطلوبة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success Toast */}
              {successToast && (
                <div className="mx-6 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center">
                  <Check className="w-4 h-4 ml-2 shrink-0 text-emerald-600" />
                  <span>{successToast}</span>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center">
                  <AlertCircle className="w-4 h-4 ml-2 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-5">

                {/* SECTION 1 — Product Info */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-lg bg-primary-100 text-primary-700 inline-flex items-center justify-center text-xs font-extrabold ml-2">
                      ١
                    </span>
                    بيانات الموديل الأساسية
                  </h4>

                  {/* Row: Name + Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم الموديل / المنتج *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: جلابية صيفي رجالي"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الماركة *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: النور، الدفة، الأصيل"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Row: Category + Selling Price + Purchase Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        التصنيف (القسم) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="مثال: جلابيات صيفي"
                        className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سعر البيع ($) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        placeholder="0"
                        value={formData.sellingPrice}
                        onChange={(e) =>
                          setFormData({ ...formData, sellingPrice: e.target.value })
                        }
                        className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سعر الشراء / التكلفة ($) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        placeholder="0"
                        value={formData.purchasePrice}
                        onChange={(e) =>
                          setFormData({ ...formData, purchasePrice: e.target.value })
                        }
                        className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Type Toggle */}
                {(() => {
                  const isExistingVariantProduct = Boolean(
                    editingProduct?.hasVariants &&
                    Array.isArray(editingProduct?.variants) &&
                    editingProduct.variants.length > 0
                  );

                  return (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">
                            هل الموديل يحتوي على مقاسات وألوان متعددة؟
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isExistingVariantProduct
                              ? 'موديل بمتغيرات مسجل في المخزن. لا يمكن تحويله لمنتج بسيط لحماية سلامة بيانات المخزون والمبيعات.'
                              : formData.hasVariants
                              ? 'تفعيل المتغيرات: يمكنك إدخال مقاسات وألوان وكمية كل تركيبة بشكل مستقل.'
                              : 'منتج عادي بسيط: يتم تحديد كمية إجمالية واحدة مباشرة في المخزن دون تقسيم مقاسات.'}
                          </p>
                        </div>
                      </div>
                      <label
                        className={`relative inline-flex items-center shrink-0 mr-4 ${
                          isExistingVariantProduct ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                        title={
                          isExistingVariantProduct
                            ? 'لا يمكن تحويل منتج بمتغيرات إلى منتج بسيط للحفاظ على سلامة المخزون'
                            : ''
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={isExistingVariantProduct}
                          checked={formData.hasVariants}
                          onChange={(e) => {
                            if (isExistingVariantProduct) return;
                            const nextVal = e.target.checked;
                            if (!nextVal && stagedVariants.length > 0) {
                              if (
                                !window.confirm(
                                  'التحويل إلى منتج بسيط سيلغي المقاسات المخصصة ويعتمد كمية إجمالية واحدة. هل تريد الاستمرار؟'
                                )
                              ) {
                                return;
                              }
                              setStagedVariants([]);
                            }
                            setFormData({ ...formData, hasVariants: nextVal });
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  );
                })()}

                {/* SECTION 2 — Inventory Entry */}
                {!formData.hasVariants ? (
                  /* Simple Product: Direct Quantity */
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center border-b border-slate-200 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-xs font-extrabold ml-2">
                        ٢
                      </span>
                      الكمية في المخزن (منتج عادي بدون مقاسات)
                    </h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        الكمية المتاحة حالياً بالمخزن *
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          placeholder="0"
                          className="block w-full sm:w-48 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white font-extrabold text-slate-900"
                        />
                        <span className="text-xs font-bold text-slate-600">قطعة</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        💡 يتم حفظ وتعديل هذه الكمية مباشرة كمنتج عادي بدون متغيرات أو مقاسات.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Variant Product: Variant Builder */
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-xs font-extrabold ml-2">
                          ٢
                        </span>
                        إدخال المقاسات والألوان والكميات
                      </h4>
                      {totalStagedPieces > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                          المجموع: {totalStagedPieces} قطعة ({stagedVariants.length} تركيبات)
                        </span>
                      )}
                    </div>

                    {/* Variant Entry Row */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                        {/* Length field */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            الطول
                            <span className="font-normal text-slate-400 mr-1">(اختياري)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="مثال: 58"
                            value={variantInput.length}
                            onChange={(e) =>
                              setVariantInput({ ...variantInput, length: e.target.value })
                            }
                            className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white font-bold text-slate-800"
                          />
                        </div>

                        {/* Width field */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            العرض
                            <span className="font-normal text-slate-400 mr-1">(اختياري)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="مثال: XL أو 5XL"
                            value={variantInput.width}
                            onChange={(e) =>
                              setVariantInput({ ...variantInput, width: e.target.value })
                            }
                            className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white font-bold text-primary-700"
                          />
                        </div>

                        {/* Color field */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            اللون
                            <span className="font-normal text-slate-400 mr-1">(اختياري)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="مثال: أبيض"
                            value={variantInput.color}
                            onChange={(e) =>
                              setVariantInput({ ...variantInput, color: e.target.value })
                            }
                            className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white"
                          />
                        </div>

                        {/* Quantity + Add/Apply button */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            الكمية *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={variantInput.quantity}
                              onChange={(e) =>
                                setVariantInput({ ...variantInput, quantity: e.target.value })
                              }
                              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 font-bold text-slate-800"
                            />
                            {editingVariantIndex !== null ? (
                              /* Apply edit in-place for the variant being edited */
                              <button
                                type="button"
                                onClick={handleApplyVariantEdit}
                                className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-sm transition whitespace-nowrap flex items-center"
                                title="تطبيق التعديل على هذا المقاس"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleAddVariant}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition whitespace-nowrap flex items-center"
                                title="إضافة هذا المقاس والكمية"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit-mode banner: shown when editing a saved variant in-place */}
                      {editingVariantIndex !== null && (
                        <div className="mt-2 flex items-center justify-between p-2 bg-primary-50 border border-primary-200 rounded-xl text-xs">
                          <span className="font-bold text-primary-800">
                            وضع التعديل: تعديل مقاس محفوظ — اضغط ✓ للتطبيق
                          </span>
                          <button
                            type="button"
                            onClick={resetVariantInput}
                            className="text-primary-600 hover:text-primary-900 font-bold underline"
                          >
                            إلغاء التعديل
                          </button>
                        </div>
                      )}

                      {/* Size Preview */}
                      {(variantInput.length || variantInput.width) && (
                        <div className="mt-2 text-xs text-slate-500">
                          المقاس المُجمَّع:{' '}
                          <span className="font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                            {buildSizeString(variantInput.length, variantInput.width) || '—'}
                          </span>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400 mt-2">
                        💡 اضغط + لإضافة المقاس إلى القائمة. يمكنك إضافة عدة مقاسات وألوان قبل الحفظ.
                      </p>
                    </div>

                    {/* Staged Variants Table */}
                    {stagedVariants.length > 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold">
                            <tr>
                              <th className="py-2 px-3 text-right">الحالة</th>
                              <th className="py-2 px-3 text-right">المقاس</th>
                              <th className="py-2 px-3 text-right">اللون</th>
                              <th className="py-2 px-3 text-center">الكمية</th>
                              <th className="py-2 px-3 text-left">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stagedVariants.map((v, idx) => {
                              const displaySize = buildSizeString(v.length, v.width);
                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-slate-50/70 transition ${
                                    editingVariantIndex === idx
                                      ? 'bg-primary-50/80 ring-1 ring-primary-400'
                                      : v.isArchived
                                      ? 'bg-slate-50/70 opacity-80'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2 px-3">
                                    {v.isArchived ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                        مؤرشف
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        نشط
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`font-bold px-2 py-0.5 rounded ${
                                        v.isArchived
                                          ? 'text-slate-600 bg-slate-100'
                                          : 'text-primary-700 bg-primary-50'
                                      }`}
                                    >
                                      {displaySize || '—'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-medium text-slate-700">
                                    {v.color || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateStagedQty(idx, -1)}
                                        className="p-0.5 text-slate-500 hover:text-red-600 rounded"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={v.quantity}
                                        onChange={(e) =>
                                          handleStagedQtyDirectEdit(idx, e.target.value)
                                        }
                                        className="w-12 text-center font-extrabold text-slate-900 bg-transparent border-none outline-none text-xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateStagedQty(idx, 1)}
                                        className="p-0.5 text-slate-500 hover:text-emerald-600 rounded"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-left space-x-1 space-x-reverse whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleEditStagedVariant(idx)}
                                      className={`p-1 rounded inline-flex items-center transition ${
                                        editingVariantIndex === idx
                                          ? 'bg-primary-600 text-white shadow-sm'
                                          : 'text-primary-600 hover:text-primary-900 hover:bg-primary-50'
                                      }`}
                                      title={editingVariantIndex === idx ? 'جاري تعديل هذا المقاس' : 'تعديل'}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {v._id ? (
                                      /* Saved variant: explicit Archive / Restore toggle button */
                                      v.isArchived ? (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleArchiveStagedVariant(idx)}
                                          className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded inline-flex items-center"
                                          title="استعادة المقاس (إعادة التفعيل للبيع)"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleArchiveStagedVariant(idx)}
                                          className="text-amber-600 hover:text-amber-800 p-1 hover:bg-amber-50 rounded inline-flex items-center"
                                          title="أرشفة المقاس (إيقاف البيع مع الحفاظ على الكمية)"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                        </button>
                                      )
                                    ) : (
                                      /* Unsaved new draft variant: can be removed from stage before saving */
                                      <button
                                        type="button"
                                        disabled={editingVariantIndex !== null}
                                        onClick={() => handleRemoveStagedVariant(idx)}
                                        className={`p-1 rounded inline-flex items-center transition ${
                                          editingVariantIndex !== null
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                        }`}
                                        title={
                                          editingVariantIndex !== null
                                            ? 'لا يمكن حذف المسودات أثناء تعديل مقاس محفوظ'
                                            : 'حذف من القائمة'
                                        }
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        أدخل الطول و/أو العرض والكمية ثم اضغط + لإضافة مقاس إلى القائمة.
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {formData.hasVariants ? (
                      totalStagedPieces > 0 ? (
                        <span className="font-bold text-slate-700">
                          سيتم حفظ إجمالي{' '}
                          <span className="text-primary-700 font-extrabold">{totalStagedPieces}</span>{' '}
                          قطعة (
                          {(() => {
                            const actCount = stagedVariants.filter((v) => !v.isArchived).length;
                            const arcCount = stagedVariants.filter((v) => v.isArchived).length;
                            return `${actCount} نشط${arcCount > 0 ? `، ${arcCount} مؤرشف` : ''}`;
                          })()}
                          ).
                        </span>
                      ) : (
                        <span>أدخل المقاسات والكميات المطلوبة ثم اضغط حفظ.</span>
                      )
                    ) : (
                      <span className="font-bold text-slate-700">
                        سيتم حفظ المنتج كمنتج عادي بكمية إجمالية:{' '}
                        <span className="text-primary-700 font-extrabold">
                          {Number(formData.quantity) || 0}
                        </span>{' '}
                        قطعة.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 border border-slate-300 text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-extrabold rounded-xl shadow-md hover:shadow-lg transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : (
                        'حفظ المنتج والمخزون'
                      )}
                    </button>
                  </div>
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
