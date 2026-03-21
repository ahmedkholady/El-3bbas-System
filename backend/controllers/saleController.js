const Sale = require('../models/Sale');
const Product = require('../models/Product');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res, next) => {
  try {
    const { product: productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      res.status(400);
      throw new Error('Invalid sale data');
    }

    const product = await Product.findById(productId);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    if (product.quantity < quantity) {
      res.status(400);
      throw new Error('Not enough stock available');
    }

    const totalPrice = req.body.totalPrice || (product.sellingPrice * quantity);

    const sale = new Sale({
      product: productId,
      quantity,
      totalPrice,
      user: req.user._id,
    });

    const createdSale = await sale.save();

    // Decrease product quantity
    product.quantity -= quantity;
    await product.save();

    // Get populated sale for socket emit
    const populatedSale = await Sale.findById(createdSale._id).populate('product', 'name brand').populate('user', 'name');

    // Emit socket event for real-time update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-sale', populatedSale);
      
      // Stock warning
      if (product.quantity <= 5) {
        io.emit('low-stock', product);
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
      .populate('product', 'name brand sellingPrice purchasePrice')
      .populate('user', 'name')
      .sort({ date: -1 });

    res.json(sales);
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/sales/dashboard
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    // Basic date range setup (today, month)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Total Daily Sales & Revenue
    const dailySales = await Sale.aggregate([
      { $match: { date: { $gte: today } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
    ]);

    // 2. Total Monthly Sales & Revenue
    const monthlySales = await Sale.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
    ]);

    // 3. Profit Calculation (Need to join with product to get purchase price)
    const allSales = await Sale.find().populate('product', 'purchasePrice sellingPrice');
    let totalProfit = 0;
    let totalRevenueAllTime = 0;
    
    allSales.forEach(sale => {
      if(sale.product) {
        const profitPerItem = sale.product.sellingPrice - sale.product.purchasePrice;
        totalProfit += profitPerItem * sale.quantity;
      }
      totalRevenueAllTime += sale.totalPrice;
    });

    // 4. Low stock products
    const lowStockProducts = await Product.find({ quantity: { $lte: 5 } }).select('name quantity brand');

    // 5. Best selling products
    const bestSelling = await Sale.aggregate([
      { $group: { _id: '$product', totalSold: { $sum: '$quantity' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);
    const bestSellingPopulated = await Product.populate(bestSelling, { path: '_id', select: 'name brand sellingPrice' });

    // 6. Recent sales
    const recentSales = await Sale.find()
      .populate('product', 'name brand')
      .sort({ date: -1 })
      .limit(10);

    res.json({
      daily: dailySales[0] || { totalRevenue: 0, count: 0 },
      monthly: monthlySales[0] || { totalRevenue: 0, count: 0 },
      totalRevenue: totalRevenueAllTime,
      totalProfit,
      lowStockProducts,
      bestSellingProducts: bestSellingPopulated.map(item => ({ product: item._id, totalSold: item.totalSold })),
      recentSales: recentSales.map(sale => ({
        productName: sale.product?.name || 'منتج محذوف',
        totalPrice: sale.totalPrice,
        quantity: sale.quantity,
        date: sale.date
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSale, getSales, getDashboardStats };
