const mongoose = require("mongoose");

const globalSettingsSchema = new mongoose.Schema(
  {
    settingsId: { type: String, default: "site_settings", unique: true },
    
    // Payment Gateway Toggles
    activePaymentMethod: { 
      type: String, 
      enum: ["razorpay", "upi"], 
      default: "upi" 
    },

    // UPI Details
    upiSettings: {
      vpa: { type: String, default: "" },
      businessName: { type: String, default: "" },
    },

    // Seed Courier Charges (per kg)
    seedCourierTN: { type: Number, default: 60 },
    seedCourierSouth: { type: Number, default: 130 },
    seedCourierRest: { type: Number, default: 160 },

    // Napier Cutting Transit Rates
    napierTransitSouthRate: { type: Number, default: 25 }, // % of cuttings value for South India
    napierTransitRestRate: { type: Number, default: 50 }, // % of cuttings value for Rest of India
    napierTransitTNRate: { type: Number, default: 0 }, // % of cuttings value for Tamil Nadu and Puducherry

    // Admin Notification Emails
    adminEmail1: { type: String, default: "" },
    adminEmail2: { type: String, default: "" },

    // Dynamic Wheel Offers
    isWheelEnabled: { type: Boolean, default: true },
    wheelOffers: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          couponCode: { type: String, default: "" },
          value: { type: Number, default: 0 },
          type: { type: String, enum: ["percentage", "flat", "none"], default: "none" },
          minOrder: { type: Number, default: 0 },
          maxDiscount: { type: Number, default: 0 },
          probability: { type: Number, default: 0, min: 0, max: 100 },
          isActive: { type: Boolean, default: true },
          usageLimit: { type: Number, default: 0 },
          usedCount: { type: Number, default: 0 },
          expiresAt: { type: Date },
          color: { type: String, default: "#ffffff" },
          textColor: { type: String, default: "#000000" }
        }
      ],
      default: [
        { id: 'wheel-1', label: '10% OFF', couponCode: 'FARMERWIN', value: 10, type: 'percentage', minOrder: 1000, maxDiscount: 200, probability: 15, isActive: true, usageLimit: 100, usedCount: 0, color: '#fde047', textColor: '#000000' },
        { id: 'wheel-2', label: 'TRY AGAIN', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 40, isActive: true, usageLimit: 0, usedCount: 0, color: '#166534', textColor: '#ffffff' },
        { id: 'wheel-3', label: 'FLAT ₹300 OFF', couponCode: 'FARMER300', value: 300, type: 'flat', minOrder: 1500, maxDiscount: 300, probability: 10, isActive: true, usageLimit: 50, usedCount: 0, color: '#eab308', textColor: '#000000' },
        { id: 'wheel-4', label: 'NO LUCK', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 20, isActive: true, usageLimit: 0, usedCount: 0, color: '#14532d', textColor: '#ffffff' },
        { id: 'wheel-5', label: '₹1000 OFF', couponCode: 'FARMER1000', value: 1000, type: 'flat', minOrder: 4000, maxDiscount: 1000, probability: 5, isActive: true, usageLimit: 10, usedCount: 0, color: '#facc15', textColor: '#000000' },
        { id: 'wheel-6', label: 'BETTER LUCK', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 10, isActive: true, usageLimit: 0, usedCount: 0, color: '#15803d', textColor: '#ffffff' }
      ]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GlobalSettings", globalSettingsSchema);
