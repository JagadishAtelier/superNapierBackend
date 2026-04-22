const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true },
    images: [{ type: String }],
    name: {
      en: { type: String, required: true },
      ta: { type: String },
      hi: { type: String },
      te: { type: String },
      kn: { type: String },
      ml: { type: String },
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    productVideoUrl: { type: String },

    description: {
      en: { type: String },
      ta: { type: String },
      hi: { type: String },
      te: { type: String },
      kn: { type: String },
      ml: { type: String },
    },
    germinationRate: { type: String },
    yieldPotential: { type: String },
    season: { type: String },
    
    youtubeVideoId: { type: String },
    statisticalHighlights: [
      {
        title: { type: String },
        description: { type: String },
        image: { type: String }
      }
    ],
    howToUseSteps: [
      {
        title: { type: String },
        heading: { type: String },
        description: { type: String },
        image: { type: String },
        bullets: [{ type: String }]
      }
    ],

    unit: { type: String, enum: ["g", "kg", "piece"], default: "kg" },
    weightOptions: [
      {
        weight: { type: Number, required: true },
        price: { type: Number, required: true },
        discountPrice: { type: Number },
        unit: { type: String, enum: ["g", "kg", "piece", "pack"], default: "kg" },
        stock: { type: Number, default: 0 },
      },
    ],

    SKU: { type: String },

    // Regional Shipping Fees
    shippingNormalTN: { type: Number, default: 0 },
    shippingExpressTN: { type: Number, default: 0 },
    shippingNormalOutside: { type: Number, default: 0 },
    shippingExpressOutside: { type: Number, default: 0 },
    isExpressOnly: { type: Boolean, default: false },
    status: { type: String, enum: ["Active", "Inactive"], default: "Inactive" },
  },
  { timestamps: true }
);

// Indexes for production performance
productSchema.index({ category: 1, status: 1 });
productSchema.index({ "name.en": "text", "name.ta": "text", "name.hi": "text" }); // Text search

module.exports = mongoose.model("Product", productSchema);
