const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleVariantArchive,
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');
const idempotency = require('../middlewares/idempotency');

router.route('/').get(protect, getProducts).post(protect, admin, idempotency, createProduct);
router
  .route('/:id')
  .get(protect, getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router
  .route('/:id/variants/:variantId/archive')
  .patch(protect, admin, toggleVariantArchive);

module.exports = router;
