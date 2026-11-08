const mongoose = require('mongoose');

const returnSchema = mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Sale',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPriceSnapshot: {
      type: Number,
      required: true,
    },
    purchasePriceSnapshot: {
      type: Number,
      required: true,
    },
    condition: {
      type: String,
      enum: ['resalable', 'damaged'],
      default: 'resalable',
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Return = mongoose.model('Return', returnSchema);
module.exports = Return;
