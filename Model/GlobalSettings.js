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

    // Shipping Defaults (Global)
    freeShippingThreshold: { type: Number, default: 999 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GlobalSettings", globalSettingsSchema);
