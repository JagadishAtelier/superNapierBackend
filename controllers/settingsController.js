const GlobalSettings = require("../Model/GlobalSettings");
const Coupon = require("../Model/CouponModel");
const { validateAndCalculateCoupon } = require("../services/couponService");

exports.getSettings = async (req, res) => {
  try {
    let settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
    if (!settings) {
      settings = await GlobalSettings.create({ settingsId: "site_settings" });
    } else {
      // Ensure defaults are populated for existing configurations
      let needsSave = false;
      if (settings.isWheelEnabled === undefined) {
        settings.isWheelEnabled = true;
        needsSave = true;
      }
      if (!settings.wheelOffers || settings.wheelOffers.length === 0) {
        settings.wheelOffers = [
          { id: 'wheel-1', label: '10% OFF', couponCode: 'FARMERWIN', value: 10, type: 'percentage', minOrder: 1000, maxDiscount: 200, probability: 15, isActive: true, usageLimit: 100, usedCount: 0, color: '#fde047', textColor: '#000000' },
          { id: 'wheel-2', label: 'TRY AGAIN', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 40, isActive: true, usageLimit: 0, usedCount: 0, color: '#166534', textColor: '#ffffff' },
          { id: 'wheel-3', label: 'FLAT ₹300 OFF', couponCode: 'FARMER300', value: 300, type: 'flat', minOrder: 1500, maxDiscount: 300, probability: 10, isActive: true, usageLimit: 50, usedCount: 0, color: '#eab308', textColor: '#000000' },
          { id: 'wheel-4', label: 'NO LUCK', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 20, isActive: true, usageLimit: 0, usedCount: 0, color: '#14532d', textColor: '#ffffff' },
          { id: 'wheel-5', label: '₹1000 OFF', couponCode: 'FARMER1000', value: 1000, type: 'flat', minOrder: 4000, maxDiscount: 1000, probability: 5, isActive: true, usageLimit: 10, usedCount: 0, color: '#facc15', textColor: '#000000' },
          { id: 'wheel-6', label: 'BETTER LUCK', couponCode: '', value: 0, type: 'none', minOrder: 0, maxDiscount: 0, probability: 10, isActive: true, usageLimit: 0, usedCount: 0, color: '#15803d', textColor: '#ffffff' }
        ];
        needsSave = true;
      }
      if (needsSave) {
        await settings.save();
      }
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const Joi = require("joi");

const settingsUpdateSchema = Joi.object({
  activePaymentMethod: Joi.string().valid("razorpay", "upi").optional(),
  upiSettings: Joi.object({
    vpa: Joi.string().allow("").optional(),
    businessName: Joi.string().allow("").optional()
  }).optional(),
  seedCourierTN: Joi.number().min(0).optional(),
  seedCourierSouth: Joi.number().min(0).optional(),
  seedCourierRest: Joi.number().min(0).optional(),
  napierTransitSouthRate: Joi.number().min(0).max(100).optional(),
  napierTransitRestRate: Joi.number().min(0).max(100).optional(),
  napierTransitTNRate: Joi.number().min(0).max(100).optional(),
  adminEmail1: Joi.string().email().allow("").optional(),
  adminEmail2: Joi.string().email().allow("").optional(),
  isWheelEnabled: Joi.boolean().optional(),
  wheelOffers: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      label: Joi.string().required(),
      couponCode: Joi.string().allow("").uppercase().trim().optional(),
      value: Joi.number().min(0).optional(),
      type: Joi.string().valid("percentage", "flat", "none").required(),
      minOrder: Joi.number().min(0).optional(),
      maxDiscount: Joi.number().min(0).optional(),
      probability: Joi.number().min(0).max(100).optional(),
      isActive: Joi.boolean().optional(),
      usageLimit: Joi.number().min(0).optional(),
      usedCount: Joi.number().min(0).optional(),
      expiresAt: Joi.date().allow(null).optional(),
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
      textColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required()
    }).unknown(true)
  ).length(6).optional()
}).unknown(true);

exports.updateSettings = async (req, res) => {
  try {
    const { error, value } = settingsUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    if (value.wheelOffers) {
      // 1. Validate none / flat / percentage configuration rules
      for (let i = 0; i < value.wheelOffers.length; i++) {
        const offer = value.wheelOffers[i];
        if (offer.type === "none") {
          if (offer.value !== 0 || offer.couponCode !== "" || offer.maxDiscount !== 0) {
            return res.status(400).json({
              success: false,
              message: `Segment ${i + 1} (${offer.label}) is of type 'none' but has non-zero values/coupon code. For type 'none', value, couponCode, and maxDiscount must be empty/0.`
            });
          }
        } else if (offer.type === "percentage") {
          if (offer.value <= 0 || offer.value > 100) {
            return res.status(400).json({
              success: false,
              message: `Segment ${i + 1} (${offer.label}) is of type 'percentage' but its value must be between 1 and 100.`
            });
          }
        } else if (offer.type === "flat") {
          if (offer.value <= 0) {
            return res.status(400).json({
              success: false,
              message: `Segment ${i + 1} (${offer.label}) is of type 'flat' but its value must be greater than 0.`
            });
          }
        }
      }

      // 2. Validate Coupon uniqueness across segments
      const codes = value.wheelOffers
        .map((o) => o.couponCode?.trim().toUpperCase())
        .filter(Boolean);
      const uniqueCodes = new Set(codes);
      if (codes.length !== uniqueCodes.size) {
        return res.status(400).json({ success: false, message: "Duplicate coupon codes are not allowed among wheel segments." });
      }

      // 3. Collision check with standard Coupons
      const collidingCoupons = await Coupon.find({ code: { $in: codes } });
      if (collidingCoupons.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Coupon codes collide with existing promotional coupons: ${collidingCoupons.map((c) => c.code).join(", ")}`
        });
      }

      // 4. Validate probability sum = exactly 100 for active segments
      const activeOffers = value.wheelOffers.filter(o => o.isActive);
      const sumProbabilities = activeOffers.reduce((sum, o) => sum + (o.probability || 0), 0);
      if (sumProbabilities !== 100) {
        return res.status(400).json({
          success: false,
          message: `The sum of probabilities for all active wheel segments must equal exactly 100. Currently it is ${sumProbabilities}.`
        });
      }

      // Inactive segments must have probability = 0
      const inactiveOffers = value.wheelOffers.filter(o => !o.isActive);
      const hasNonZeroInactive = inactiveOffers.some(o => o.probability !== 0);
      if (hasNonZeroInactive) {
        return res.status(400).json({
          success: false,
          message: "Inactive wheel segments must have their probability set to 0."
        });
      }
    }

    console.log(`[Audit] Global settings updated by user ${req.user ? req.user._id : 'admin'} at ${new Date().toISOString()}. Updated values:`, JSON.stringify(value));

    const settings = await GlobalSettings.findOneAndUpdate(
      { settingsId: "site_settings" },
      { $set: value },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    if (!couponCode) {
      return res.status(400).json({ valid: false, message: "Coupon code is required" });
    }
    if (subtotal === undefined || subtotal < 0) {
      return res.status(400).json({ valid: false, message: "Valid subtotal is required" });
    }

    const result = await validateAndCalculateCoupon(couponCode, subtotal);
    if (!result.isValid) {
      return res.status(400).json({ valid: false, message: result.message });
    }

    return res.status(200).json({
      valid: true,
      couponCode: result.couponCode,
      type: result.type === "promotional" ? "percentage" : result.offer.type,
      value: result.value,
      discount: result.discount,
      finalSubtotal: subtotal - result.discount
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

exports.spinWheel = async (req, res) => {
  try {
    const settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
    if (!settings || !settings.isWheelEnabled) {
      return res.status(400).json({ success: false, message: "Spin wheel is currently disabled." });
    }

    const activeOffers = (settings.wheelOffers || []).filter(o => o.isActive);
    if (activeOffers.length === 0) {
      return res.status(400).json({ success: false, message: "No active offers configured." });
    }

    // Weighted selector logic
    const totalProbability = activeOffers.reduce((sum, o) => sum + (o.probability || 0), 0);
    let winningOffer = null;
    
    if (totalProbability <= 0) {
      winningOffer = activeOffers[Math.floor(Math.random() * activeOffers.length)];
    } else {
      let randomVal = Math.random() * totalProbability;
      for (const offer of activeOffers) {
        if (randomVal < (offer.probability || 0)) {
          winningOffer = offer;
          break;
        }
        randomVal -= (offer.probability || 0);
      }
    }

    if (!winningOffer) {
      winningOffer = activeOffers[0];
    }

    return res.status(200).json({
      success: true,
      offer: {
        id: winningOffer.id,
        label: winningOffer.label,
        couponCode: winningOffer.couponCode,
        type: winningOffer.type,
        value: winningOffer.value,
        color: winningOffer.color,
        textColor: winningOffer.textColor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const { INDIAN_STATES } = require("../utils/shippingRegion");

exports.getStates = async (req, res) => {
  try {
    res.status(200).json({ success: true, states: INDIAN_STATES });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
