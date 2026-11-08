const mongoose = require('mongoose');
const Product = require('../models/Product');

// @desc    Fetch all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res, next) => {
  try {
    const keyword = req.query.keyword ? req.query.keyword.trim() : '';
    const filter = {};

    if (keyword) {
      const regex = { $regex: keyword, $options: 'i' };
      filter.$or = [
        { name: regex },
        { brand: regex },
        { 'variants.color': regex },
        { 'variants.size': regex },
      ];
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Private
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      res.json(product);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      sellingPrice,
      purchasePrice,
      quantity,
      category,
      hasVariants,
      variants,
      lowStockThreshold,
    } = req.body;

    const trimmedName = (name && String(name).trim()) || '';
    if (!trimmedName) {
      res.status(400);
      throw new Error('اسم المنتج لا يمكن أن يكون فارغاً');
    }

    const trimmedBrand = (brand && String(brand).trim()) || '';
    if (!trimmedBrand) {
      res.status(400);
      throw new Error('الماركة لا يمكن أن تكون فارغة');
    }

    const trimmedCategory = (category && String(category).trim()) || 'عام';

    const sp = Number(sellingPrice);
    if (!Number.isFinite(sp) || sp < 0) {
      res.status(400);
      throw new Error('سعر البيع يجب أن يكون رقماً لا يقل عن الصفر');
    }

    const pp = Number(purchasePrice);
    if (!Number.isFinite(pp) || pp < 0) {
      res.status(400);
      throw new Error('سعر الشراء يجب أن يكون رقماً لا يقل عن الصفر');
    }

    let parsedVariants = [];
    let totalQuantity = Number(quantity) || 0;
    const isVariantProduct = Boolean(hasVariants && Array.isArray(variants) && variants.length > 0);

    if (isVariantProduct) {
      const mergedMap = new Map();
      variants.forEach((v) => {
        const color = (v.color || '').trim();
        const size = (v.size || '').trim().replace(/\s+/g, ' ');
        const key = `${color.toLowerCase()}___${size.toLowerCase()}`;
        const qty = Math.max(0, Number(v.quantity) || 0);
        if (mergedMap.has(key)) {
          mergedMap.get(key).quantity += qty;
        } else {
          mergedMap.set(key, {
            color,
            size,
            quantity: qty,
            sellingPrice: v.sellingPrice !== undefined && v.sellingPrice !== '' ? Number(v.sellingPrice) : sp,
            purchasePrice: v.purchasePrice !== undefined && v.purchasePrice !== '' ? Number(v.purchasePrice) : pp,
            sku: (v.sku || '').trim(),
            isArchived: Boolean(v.isArchived),
          });
        }
      });
      parsedVariants = Array.from(mergedMap.values());
      totalQuantity = parsedVariants.reduce((sum, v) => sum + v.quantity, 0);
    } else {
      totalQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    }

    const product = new Product({
      name: trimmedName,
      brand: trimmedBrand,
      sellingPrice: sp,
      purchasePrice: pp,
      quantity: totalQuantity,
      category: trimmedCategory,
      hasVariants: isVariantProduct,
      variants: parsedVariants,
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      sellingPrice,
      purchasePrice,
      quantity,
      category,
      hasVariants,
      variants,
      lowStockThreshold,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        res.status(400);
        throw new Error('اسم المنتج لا يمكن أن يكون فارغاً');
      }
      product.name = trimmedName;
    }

    if (brand !== undefined) {
      const trimmedBrand = String(brand).trim();
      if (!trimmedBrand) {
        res.status(400);
        throw new Error('الماركة لا يمكن أن تكون فارغة');
      }
      product.brand = trimmedBrand;
    }

    if (category !== undefined) {
      const trimmedCategory = String(category).trim();
      if (!trimmedCategory) {
        res.status(400);
        throw new Error('التصنيف لا يمكن أن يكون فارغاً');
      }
      product.category = trimmedCategory;
    }

    if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== '') {
      const sp = Number(sellingPrice);
      if (!Number.isFinite(sp) || sp < 0) {
        res.status(400);
        throw new Error('سعر البيع يجب أن يكون رقماً صحيحاً أو عشرياً لا يقل عن الصفر');
      }
      product.sellingPrice = sp;
    }

    if (purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== '') {
      const pp = Number(purchasePrice);
      if (!Number.isFinite(pp) || pp < 0) {
        res.status(400);
        throw new Error('سعر الشراء يجب أن يكون رقماً صحيحاً أو عشرياً لا يقل عن الصفر');
      }
      product.purchasePrice = pp;
    }

    if (lowStockThreshold !== undefined && lowStockThreshold !== null && lowStockThreshold !== '') {
      const th = Number(lowStockThreshold);
      if (!Number.isFinite(th) || th < 0) {
        res.status(400);
        throw new Error('حد النواقص يجب أن يكون رقماً لا يقل عن الصفر');
      }
      product.lowStockThreshold = Math.floor(th);
    }

    const isCurrentlyVariant = Boolean(
      product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0
    );

    if (isCurrentlyVariant) {
      // 1. Existing Variant Product
      // Reject any attempt to convert an existing variant product into a simple product
      if (hasVariants === false) {
        res.status(400);
        throw new Error('لا يمكن تحويل منتج بمتغيرات مسجل مسبقاً إلى منتج بسيط لحماية سلامة بيانات المخزون');
      }

      if (variants !== undefined) {
        // If variants array is provided, it must be a non-empty array
        if (!Array.isArray(variants) || variants.length === 0) {
          res.status(400);
          throw new Error('يرجى تزويد قائمة مقاسات ومتغيرات صحيحة للمنتج');
        }

        // Map existing variant IDs for strict ownership validation
        const existingVariantIds = new Set(
          product.variants.map((v) => v._id.toString())
        );

        const incomingById = new Map();
        const incomingNewByCombo = new Map();

        for (const v of variants) {
          if (!v || typeof v !== 'object') {
            res.status(400);
            throw new Error('بيانات المقاسات غير صحيحة');
          }

          // Validate variant ID if supplied
          if (v._id) {
            const vIdStr = String(v._id);
            if (!mongoose.Types.ObjectId.isValid(vIdStr)) {
              res.status(400);
              throw new Error(`معرف المقاس (${vIdStr}) غير صالح`);
            }
            if (!existingVariantIds.has(vIdStr)) {
              res.status(400);
              throw new Error(`معرف المتغير (${vIdStr}) لا ينتمي لهذا المنتج`);
            }
          }

          // Strict validation on isArchived if present
          if (v.isArchived !== undefined && typeof v.isArchived !== 'boolean') {
            res.status(400);
            throw new Error('حالة الأرشفة للمتغير يجب أن تكون قيمة منطقية صريحة (true أو false)');
          }

          const color = (v.color || '').trim();
          const size = (v.size || '').trim().replace(/\s+/g, ' ');

          if (!color && !size) {
            res.status(400);
            throw new Error('يجب إدخال المقاس أو اللون لكل متغير');
          }

          if (
            v.quantity === undefined ||
            v.quantity === null ||
            v.quantity === '' ||
            !Number.isFinite(Number(v.quantity)) ||
            !Number.isInteger(Number(v.quantity)) ||
            Number(v.quantity) < 0
          ) {
            res.status(400);
            throw new Error('الكمية لكل مقاس يجب أن تكون رقماً صحيحاً لا يقل عن الصفر');
          }

          const qty = Number(v.quantity);
          const vSellingPrice =
            v.sellingPrice !== undefined && v.sellingPrice !== null && v.sellingPrice !== ''
              ? Number(v.sellingPrice)
              : product.sellingPrice;
          const vPurchasePrice =
            v.purchasePrice !== undefined && v.purchasePrice !== null && v.purchasePrice !== ''
              ? Number(v.purchasePrice)
              : product.purchasePrice;
          const vSku = (v.sku || '').trim();

          if (v._id) {
            const idKey = String(v._id);
            if (incomingById.has(idKey)) {
              const existingIncoming = incomingById.get(idKey);
              existingIncoming.quantity += qty;
              if (typeof v.isArchived === 'boolean') {
                existingIncoming.isArchived = v.isArchived;
              }
            } else {
              incomingById.set(idKey, {
                _id: v._id,
                color,
                size,
                quantity: qty,
                sellingPrice: vSellingPrice,
                purchasePrice: vPurchasePrice,
                sku: vSku,
                isArchived: typeof v.isArchived === 'boolean' ? v.isArchived : undefined,
              });
            }
          } else {
            const comboKey = `${color.toLowerCase()}___${size.toLowerCase()}`;
            if (incomingNewByCombo.has(comboKey)) {
              incomingNewByCombo.get(comboKey).quantity += qty;
            } else {
              incomingNewByCombo.set(comboKey, {
                color,
                size,
                quantity: qty,
                sellingPrice: vSellingPrice,
                purchasePrice: vPurchasePrice,
                sku: vSku,
                isArchived: typeof v.isArchived === 'boolean' ? v.isArchived : false,
              });
            }
          }
        }

        // Apply updates to existing variants without deleting unmentioned ones
        for (const existingV of product.variants) {
          const idStr = existingV._id.toString();
          if (incomingById.has(idStr)) {
            const updateItem = incomingById.get(idStr);
            existingV.color = updateItem.color;
            existingV.size = updateItem.size;
            existingV.quantity = updateItem.quantity;
            existingV.sellingPrice = updateItem.sellingPrice;
            existingV.purchasePrice = updateItem.purchasePrice;
            existingV.sku = updateItem.sku;
            if (typeof updateItem.isArchived === 'boolean') {
              existingV.isArchived = updateItem.isArchived;
            }
          }
          // If not in incomingById, existingV is left completely untouched!
        }

        // Add newly added variants (without _id)
        for (const newV of incomingNewByCombo.values()) {
          // Check if an existing variant has identical color and size
          const existingMatch = product.variants.find(
            (ev) =>
              (ev.color || '').trim().toLowerCase() === newV.color.toLowerCase() &&
              (ev.size || '').trim().toLowerCase() === newV.size.toLowerCase()
          );

          if (existingMatch) {
            existingMatch.quantity += newV.quantity;
            if (typeof newV.isArchived === 'boolean') {
              existingMatch.isArchived = newV.isArchived;
            }
          } else {
            product.variants.push(newV);
          }
        }

        product.hasVariants = true;
        product.quantity = product.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
      } else {
        // req.body.variants is undefined (partial update of name, brand, prices, etc.)
        // product.variants remains 100% untouched!
        product.hasVariants = true;
        product.quantity = product.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
      }

    } else {
      // 2. Existing Simple Product
      if (hasVariants === true) {
        // Explicit conversion to variant product requires a valid, non-empty variants array
        if (!variants || !Array.isArray(variants) || variants.length === 0) {
          res.status(400);
          throw new Error('يرجى تزويد قائمة مقاسات ومتغيرات صحيحة للتحويل إلى منتج بمتغيرات');
        }

        const mergedMap = new Map();
        for (const v of variants) {
          if (!v || typeof v !== 'object') {
            res.status(400);
            throw new Error('بيانات المقاسات غير صحيحة');
          }

          const color = (v.color || '').trim();
          const size = (v.size || '').trim().replace(/\s+/g, ' ');

          if (!color && !size) {
            res.status(400);
            throw new Error('يجب إدخال المقاس أو اللون لكل متغير');
          }

          if (
            v.quantity === undefined ||
            v.quantity === null ||
            v.quantity === '' ||
            !Number.isFinite(Number(v.quantity)) ||
            !Number.isInteger(Number(v.quantity)) ||
            Number(v.quantity) < 0
          ) {
            res.status(400);
            throw new Error('الكمية لكل مقاس يجب أن تكون رقماً صحيحاً لا يقل عن الصفر');
          }

          const qty = Number(v.quantity);
          const key = `${color.toLowerCase()}___${size.toLowerCase()}`;

          if (mergedMap.has(key)) {
            mergedMap.get(key).quantity += qty;
          } else {
            mergedMap.set(key, {
              color,
              size,
              quantity: qty,
              sellingPrice:
                v.sellingPrice !== undefined && v.sellingPrice !== null && v.sellingPrice !== ''
                  ? Number(v.sellingPrice)
                  : product.sellingPrice,
              purchasePrice:
                v.purchasePrice !== undefined && v.purchasePrice !== null && v.purchasePrice !== ''
                  ? Number(v.purchasePrice)
                  : product.purchasePrice,
              sku: (v.sku || '').trim(),
            });
          }
        }

        product.hasVariants = true;
        product.variants = Array.from(mergedMap.values());
        product.quantity = product.variants.reduce((sum, v) => sum + v.quantity, 0);

      } else {
        // Normal simple product update — stay simple product
        product.hasVariants = false;
        product.variants = [];

        // Update quantity ONLY when explicitly provided
        if (quantity !== undefined && quantity !== null && quantity !== '') {
          const q = Number(quantity);
          if (!Number.isFinite(q) || !Number.isInteger(q) || q < 0) {
            res.status(400);
            throw new Error('كمية المخزون يجب أن تكون رقماً صحيحاً لا يقل عن الصفر');
          }
          product.quantity = q;
        }
        // If quantity is omitted/undefined, product.quantity remains intact!
      }
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle archive status of a specific variant
// @route   PATCH /api/products/:id/variants/:variantId/archive
// @access  Private/Admin
const toggleVariantArchive = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const { isArchived } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error('معرف المنتج غير صالح');
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      res.status(400);
      throw new Error('معرف المتغير غير صالح');
    }

    // Strict validation: must be actual boolean true or false
    if (typeof isArchived !== 'boolean') {
      res.status(400);
      throw new Error('حالة الأرشفة يجب أن تكون قيمة منطقية صريحة (true أو false)');
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404);
      throw new Error('المنتج غير موجود');
    }

    if (!product.hasVariants || !Array.isArray(product.variants) || product.variants.length === 0) {
      res.status(400);
      throw new Error('المنتج ليس له متغيرات أو مقاسات');
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      res.status(404);
      throw new Error('المقاس أو المتغير غير موجود في هذا المنتج');
    }

    // Set archive status strictly
    variant.isArchived = isArchived;

    // Preserves physical stock total across all variants
    product.quantity = product.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

    const updatedProduct = await product.save();

    res.json({
      message: isArchived ? 'تمت أرشفة المقاس بنجاح' : 'تمت استعادة المقاس وإلغاء الأرشفة بنجاح',
      product: updatedProduct,
      variant,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleVariantArchive,
};
