const express = require('express');
const router = express.Router();
const { createSale, getSales, getDashboardStats } = require('../controllers/saleController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').post(protect, createSale).get(protect, getSales);
router.route('/dashboard').get(protect, admin, getDashboardStats);

module.exports = router;
