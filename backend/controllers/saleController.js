const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Return = require('../models/Return');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res, next) => {
  try {
    const { product: productId, variantId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      res.status(400);
      throw new Error('بيانات الفاتورة غير صحيحة');
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404);
      throw new Error('المنتج غير موجود');
    }

    let selectedVariant = null;
    let unitSellingPrice = product.sellingPrice;
    let unitPurchasePrice = product.purchasePrice;
    let variantColor = '';
    let variantSize = '';

    // Handle products with variants
    if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
      if (variantId) {
        selectedVariant = product.variants.id(variantId);
      }
      // Auto-select only if there is exactly 1 active (non-archived) variant
      const activeVariants = product.variants.filter((v) => !v.isArchived);
      if (!selectedVariant && activeVariants.length === 1) {
        selectedVariant = activeVariants[0];
      }
      if (!selectedVariant) {
        res.status(400);
        throw new Error('يرجى تحديد المقاس واللون المطلوب بيعه');
      }

      // Block sale if the resolved variant is archived — even if variantId was explicitly supplied
      if (selectedVariant.isArchived) {
        res.status(400);
        throw new Error('المقاس أو اللون المحدد مؤرشف ولا يمكن بيعه');
      }

      if (selectedVariant.quantity < quantity) {
        res.status(400);
        throw new Error(`الكمية المتاحة في المخزن (${selectedVariant.quantity}) غير كافية`);
      }

      variantColor = selectedVariant.color || '';
      variantSize = selectedVariant.size || '';
      unitSellingPrice = selectedVariant.sellingPrice !== undefined ? selectedVariant.sellingPrice : product.sellingPrice;
      unitPurchasePrice = selectedVariant.purchasePrice !== undefined ? selectedVariant.purchasePrice : product.purchasePrice;

      // Decrement variant stock
      selectedVariant.quantity -= quantity;
      product.quantity = product.variants.reduce((sum, v) => sum + v.quantity, 0);
      await product.save();
    } else {
      // Simple product without variants
      if (product.quantity < quantity) {
        res.status(400);
        throw new Error(`الكمية المتاحة في المخزن (${product.quantity}) غير كافية`);
      }

      product.quantity -= quantity;
      await product.save();
    }

    const totalPrice = req.body.totalPrice !== undefined ? Number(req.body.totalPrice) : (unitSellingPrice * quantity);

    const sale = new Sale({
      product: productId,
      variantId: selectedVariant ? selectedVariant._id : null,
      variantColor,
      variantSize,
      quantity,
      totalPrice,
      sellingPrice: totalPrice / quantity,
      purchasePrice: unitPurchasePrice,
      user: req.user._id,
    });

    const createdSale = await sale.save();

    // Get populated sale for socket emit and response
    const populatedSale = await Sale.findById(createdSale._id)
      .populate('product', 'name brand sellingPrice purchasePrice')
      .populate('user', 'name');

    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-sale', populatedSale);

      // Stock warning check
      const remainingQty = selectedVariant ? selectedVariant.quantity : product.quantity;
      const threshold = product.lowStockThreshold || 5;
      if (remainingQty <= threshold) {
        io.emit('low-stock', {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          variantColor,
          variantSize,
          quantity: remainingQty,
          threshold,
        });
      }
    }

    res.status(201).json(populatedSale);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res, next) => {
  try {
    let query = {};
    if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }

    const sales = await Sale.find(query)
      .populate('product', 'name brand sellingPrice purchasePrice category')
      .populate('user', 'name')
      .sort({ date: -1 });

    res.json(sales);
  } catch (error) {
    next(error);
  }
};

// @desc    Create return for a sale
// @route   POST /api/sales/:id/return
// @access  Private
const createReturn = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const { quantity, condition = 'resalable', reason = '' } = req.body;

    const returnQty = Number(quantity);
    if (!returnQty || returnQty <= 0) {
      res.status(400);
      throw new Error('يرجى تحديد كمية مرتجع صحيحة أكبر من الصفر');
    }

    const sale = await Sale.findById(saleId);
    if (!sale) {
      res.status(404);
      throw new Error('الفاتورة غير موجودة');
    }

    const alreadyReturned = sale.returnedQuantity || 0;
    const maxReturnable = sale.quantity - alreadyReturned;

    if (returnQty > maxReturnable) {
      res.status(400);
      throw new Error(`الكمية المرتجعة (${returnQty}) أكبر من الكمية المتبقية القابلة للإرجاع (${maxReturnable})`);
    }

    const unitSellingPrice = sale.sellingPrice || (sale.totalPrice / sale.quantity);
    const unitPurchasePrice = sale.purchasePrice || 0;
    const refundAmount = unitSellingPrice * returnQty;

    // Inventory handling: only restore stock if item is resalable.
    // Stock is restored to the original variant (active or archived).
    // isArchived status is intentionally preserved — archiving is never reverted by a return.
    if (condition === 'resalable') {
      const product = await Product.findById(sale.product);
      if (product) {
        if (sale.variantId && product.hasVariants && Array.isArray(product.variants)) {
          const variant = product.variants.id(sale.variantId);
          if (variant) {
            // Restore stock to the exact original variant regardless of its isArchived state
            variant.quantity += returnQty;
            // isArchived is NOT modified — restoring stock is independent of archive status
          }
          product.quantity = product.variants.reduce((sum, v) => sum + v.quantity, 0);
        } else {
          product.quantity += returnQty;
        }
        await product.save();
      } else {
        console.warn(
          `[createReturn Warning] Resalable return for deleted product — stock cannot be restored. Sale ID: ${sale._id}, Product ID: ${sale.product}`
        );
      }
    }

    // Update sale record
    sale.returnedQuantity = alreadyReturned + returnQty;
    sale.returnStatus = sale.returnedQuantity >= sale.quantity ? 'full' : 'partial';
    await sale.save();

    // Create return record
    const returnRecord = new Return({
      sale: sale._id,
      product: sale.product,
      variantId: sale.variantId || null,
      variantColor: sale.variantColor || '',
      variantSize: sale.variantSize || '',
      quantity: returnQty,
      refundAmount,
      sellingPriceSnapshot: unitSellingPrice,
      purchasePriceSnapshot: unitPurchasePrice,
      condition,
      reason,
      user: req.user._id,
      date: new Date(),
    });

    const createdReturn = await returnRecord.save();
    const populatedReturn = await Return.findById(createdReturn._id)
      .populate('sale')
      .populate('product', 'name brand')
      .populate('user', 'name');

    // Socket notification
    const io = req.app.get('socketio');
    if (io) {
      io.emit('sale-returned', populatedReturn);
    }

    res.status(201).json(populatedReturn);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all returns
// @route   GET /api/sales/returns
// @access  Private
const getReturns = async (req, res, next) => {
  try {
    const returns = await Return.find()
      .populate('sale')
      .populate('product', 'name brand category')
      .populate('user', 'name')
      .sort({ date: -1 });

    res.json(returns);
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/sales/dashboard
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const defaultThreshold = Number(req.query.threshold) || 5;

    // Date range setup
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Total Daily Sales & Returns
    const [dailySales, dailyReturns] = await Promise.all([
      Sale.aggregate([
        { $match: { date: { $gte: today } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      Return.aggregate([
        { $match: { date: { $gte: today } } },
        { $group: { _id: null, totalRefund: { $sum: '$refundAmount' } } },
      ]),
    ]);

    const grossDailyRev = dailySales[0]?.totalRevenue || 0;
    const dailyRefund = dailyReturns[0]?.totalRefund || 0;
    const netDailyRevenue = Math.max(0, grossDailyRev - dailyRefund);

    // 2. Total Monthly Sales & Returns
    const [monthlySales, monthlyReturns] = await Promise.all([
      Sale.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      Return.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, totalRefund: { $sum: '$refundAmount' } } },
      ]),
    ]);

    const grossMonthlyRev = monthlySales[0]?.totalRevenue || 0;
    const monthlyRefund = monthlyReturns[0]?.totalRefund || 0;
    const netMonthlyRevenue = Math.max(0, grossMonthlyRev - monthlyRefund);

    // 3. Profit & All-Time Revenue Calculation (accounting for returns)
    const [allSales, allReturns] = await Promise.all([
      Sale.find().populate('product', 'purchasePrice sellingPrice'),
      Return.find(),
    ]);

    let totalProfit = 0;
    let totalRevenueAllTime = 0;

    allSales.forEach((sale) => {
      const sellingPrice = sale.sellingPrice || (sale.totalPrice / sale.quantity);
      const purchasePrice = sale.purchasePrice || (sale.product?.purchasePrice || 0);

      const profitPerItem = sellingPrice - purchasePrice;
      totalProfit += profitPerItem * sale.quantity;
      totalRevenueAllTime += sale.totalPrice;
    });

    // Deduct returns from revenue and profit
    const totalRefundAllTime = allReturns.reduce((sum, r) => sum + r.refundAmount, 0);
    const totalReturnedProfit = allReturns.reduce(
      (sum, r) => sum + (r.sellingPriceSnapshot - r.purchasePriceSnapshot) * r.quantity,
      0
    );
    const totalDamagedCost = allReturns
      .filter((r) => r.condition === 'damaged')
      .reduce((sum, r) => sum + r.purchasePriceSnapshot * r.quantity, 0);

    const netTotalRevenue = Math.max(0, totalRevenueAllTime - totalRefundAllTime);
    const netTotalProfit = Math.max(0, totalProfit - totalReturnedProfit - totalDamagedCost);

    // 3a. Weekly History for Chart (Net Sales per day)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [weeklySalesAgg, weeklyReturnsAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { date: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            total: { $sum: '$totalPrice' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Return.aggregate([
        { $match: { date: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            totalRefund: { $sum: '$refundAmount' },
          },
        },
      ]),
    ]);

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      const daySales = weeklySalesAgg.find((a) => a._id === dateStr)?.total || 0;
      const dayRefund = weeklyReturnsAgg.find((a) => a._id === dateStr)?.totalRefund || 0;
      chartData.push({ name: dayName, value: Math.max(0, daySales - dayRefund) });
    }

    // 4. Low stock products grouped by brand and detailed variants
    const allProducts = await Product.find();
    const lowStockItems = [];
    const lowStockByBrandMap = {};

    allProducts.forEach((prod) => {
      const itemThreshold = prod.lowStockThreshold || defaultThreshold;

      if (prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0) {
        prod.variants.forEach((variant) => {
          // Skip archived variants — they are no longer actively sold
          // and must not generate false shortage alerts
          if (variant.isArchived) return;
          if (variant.quantity <= itemThreshold) {
            const item = {
              _id: `${prod._id}_${variant._id}`,
              productId: prod._id,
              name: prod.name,
              brand: prod.brand,
              category: prod.category,
              isVariant: true,
              variantId: variant._id,
              color: variant.color || '',
              size: variant.size || '', // Complete size value (e.g. "58 XL")
              quantity: variant.quantity,
              threshold: itemThreshold,
            };
            lowStockItems.push(item);

            if (!lowStockByBrandMap[prod.brand]) {
              lowStockByBrandMap[prod.brand] = {
                brand: prod.brand,
                totalShortages: 0,
                items: [],
              };
            }
            lowStockByBrandMap[prod.brand].totalShortages += 1;
            lowStockByBrandMap[prod.brand].items.push(item);
          }
        });
      } else {
        if (prod.quantity <= itemThreshold) {
          const item = {
            _id: prod._id.toString(),
            productId: prod._id,
            name: prod.name,
            brand: prod.brand,
            category: prod.category,
            isVariant: false,
            color: '',
            size: '',
            quantity: prod.quantity,
            threshold: itemThreshold,
          };
          lowStockItems.push(item);

          if (!lowStockByBrandMap[prod.brand]) {
            lowStockByBrandMap[prod.brand] = {
              brand: prod.brand,
              totalShortages: 0,
              items: [],
            };
          }
          lowStockByBrandMap[prod.brand].totalShortages += 1;
          lowStockByBrandMap[prod.brand].items.push(item);
        }
      }
    });

    const lowStockByBrand = Object.values(lowStockByBrandMap).sort(
      (a, b) => b.totalShortages - a.totalShortages
    );

    // 5. Best selling products (excluding returns)
    const bestSelling = await Sale.aggregate([
      { $group: { _id: '$product', totalSold: { $sum: '$quantity' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);
    const bestSellingPopulated = await Product.populate(bestSelling, {
      path: '_id',
      select: 'name brand sellingPrice',
    });

    // 6. Recent sales
    const recentSales = await Sale.find()
      .populate('product', 'name brand')
      .sort({ date: -1 })
      .limit(10);

    res.json({
      daily: {
        totalRevenue: netDailyRevenue,
        grossRevenue: grossDailyRev,
        refundAmount: dailyRefund,
        count: dailySales[0]?.count || 0,
      },
      monthly: {
        totalRevenue: netMonthlyRevenue,
        grossRevenue: grossMonthlyRev,
        refundAmount: monthlyRefund,
        count: monthlySales[0]?.count || 0,
      },
      totalRevenue: netTotalRevenue,
      grossRevenue: totalRevenueAllTime,
      totalRefunds: totalRefundAllTime,
      totalProfit: netTotalProfit,
      chartData,
      lowStockProducts: lowStockItems,
      lowStockByBrand,
      defaultThreshold,
      bestSellingProducts: bestSellingPopulated.map((item) => ({
        product: item._id,
        totalSold: item.totalSold,
      })),
      recentSales: recentSales.map((sale) => ({
        _id: sale._id,
        productName: sale.product?.name || 'منتج محذوف',
        variantColor: sale.variantColor,
        variantSize: sale.variantSize,
        totalPrice: sale.totalPrice,
        quantity: sale.quantity,
        returnedQuantity: sale.returnedQuantity || 0,
        returnStatus: sale.returnStatus || 'none',
        date: sale.date,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSale,
  getSales,
  createReturn,
  getReturns,
  getDashboardStats,
};
