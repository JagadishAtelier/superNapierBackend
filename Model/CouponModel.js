const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    code: { 
      type: String, 
      required: true, 
      unique: true,
      uppercase: true,
      trim: true 
    },

    percentage: { 
      type: Number, 
      required: true,
      min: 1,
      max: 100
    },

    minOrderAmount: {
      type: Number,
      default: 0
    },

    maxDiscountAmount: {
      type: Number,
      default: 0
    },

    startDate: { 
      type: Date, 
      required: true 
    },

    endDate: { 
      type: Date, 
      required: true 
    },

    usageLimit: { 
      type: Number, 
      default: 0
    },

    usedCount: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active"
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
