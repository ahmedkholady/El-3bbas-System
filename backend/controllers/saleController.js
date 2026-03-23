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
      sellingPrice: totalPrice / quantity,
      purchasePrice: product.purchasePrice,
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

    // 3. Profit Calculation (using historical prices if available)
    const allSales = await Sale.find().populate('product', 'purchasePrice sellingPrice');
    let totalProfit = 0;
    let totalRevenueAllTime = 0;
    
    allSales.forEach(sale => {
      // Historical profit: Use sale record's purchase price and selling price if they exist
      // Fallback to current product price for old records
      const sellingPrice = sale.sellingPrice || (sale.totalPrice / sale.quantity);
      const purchasePrice = sale.purchasePrice || (sale.product?.purchasePrice || 0);
      
      const profitPerItem = sellingPrice - purchasePrice;
      totalProfit += profitPerItem * sale.quantity;
      totalRevenueAllTime += sale.totalPrice;
    });

    // 3a. Weekly History for Chart
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    const weeklyAggregation = await Sale.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, 
          total: { $sum: "$totalPrice" } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days for the chart
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      const dayData = weeklyAggregation.find(a => a._id === dateStr);
      chartData.push({ name: dayName, value: dayData ? dayData.total : 0 });
    }

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
      chartData,
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
