const mongoose = require('mongoose');

const variantSchema = mongoose.Schema(
  {
    color: {
      type: String,
      trim: true,
      default: '',
    },
    // The complete size value (e.g. "58 XL", "60", "L") - never split
    size: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
    },
    purchasePrice: {
      type: Number,
    },
    sku: {
      type: String,
      trim: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    category: {
      type: String,
      required: true,
      default: 'عام',
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: [variantSchema],
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Keep total quantity in sync with variants when variants are present
productSchema.pre('save', function (next) {
  if (this.hasVariants && Array.isArray(this.variants) && this.variants.length > 0) {
    this.quantity = this.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
  }
  if (typeof next === 'function') next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
