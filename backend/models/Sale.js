const mongoose = require('mongoose');

const saleSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    quantity: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantColor: {
      type: String,
      default: '',
    },
    variantSize: {
      type: String,
      default: '',
    },
    returnedQuantity: {
      type: Number,
      default: 0,
    },
    returnStatus: {
      type: String,
      enum: ['none', 'partial', 'full'],
      default: 'none',
    },
  },
  {
    timestamps: true,
  }
);

const Sale = mongoose.model('Sale', saleSchema);
module.exports = Sale;
