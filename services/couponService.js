const Coupon = require("../Model/CouponModel");
const GlobalSettings = require("../Model/GlobalSettings");

const validateAndCalculateCoupon = async (code, subtotal) => {
  if (!code) {
    return { isValid: false, message: "Coupon code is required" };
  }
  const targetCode = code.trim().toUpperCase();

  // 1. Check Coupon collection
  const promoCoupon = await Coupon.findOne({ code: targetCode });
  if (promoCoupon) {
    if (promoCoupon.status !== "active") {
      return { isValid: false, message: "Coupon is inactive" };
    }
    const now = new Date();
    if (now < promoCoupon.startDate || now > promoCoupon.endDate) {
      return { isValid: false, message: "Coupon is expired or has not started" };
    }
    if (promoCoupon.usageLimit > 0 && promoCoupon.usedCount >= promoCoupon.usageLimit) {
      return { isValid: false, message: "Coupon usage limit reached" };
    }
    if (subtotal < promoCoupon.minOrderAmount) {
      return { isValid: false, message: `Minimum order amount of ₹${promoCoupon.minOrderAmount} is required` };
    }

    const discount = Math.min((subtotal * promoCoupon.percentage) / 100, promoCoupon.maxDiscountAmount || Infinity);
    return {
      isValid: true,
      type: "promotional",
      model: promoCoupon,
      couponCode: targetCode,
      minOrder: promoCoupon.minOrderAmount,
      discount,
      value: promoCoupon.percentage
    };
  }

  // 2. Check GlobalSettings wheel offers
  const settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
  const offer = settings?.wheelOffers?.find(o => o.couponCode?.toUpperCase() === targetCode);
  if (offer) {
    if (!offer.isActive) {
      return { isValid: false, message: "This coupon is inactive" };
    }
    if (offer.type === "none") {
      return { isValid: false, message: "This coupon has no discount associated with it" };
    }
    if (offer.expiresAt && new Date() > new Date(offer.expiresAt)) {
      return { isValid: false, message: "Coupon is expired" };
    }
    if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) {
      return { isValid: false, message: "Coupon usage limit reached" };
    }
    if (subtotal < offer.minOrder) {
      return { isValid: false, message: `Minimum order amount of ₹${offer.minOrder} is required` };
    }

    let discount = 0;
    if (offer.type === "percentage") {
      discount = subtotal * (offer.value / 100);
      if (offer.maxDiscount && offer.maxDiscount > 0) {
        discount = Math.min(discount, offer.maxDiscount);
      }
    } else if (offer.type === "flat") {
      discount = Math.min(subtotal, offer.value);
    }

    return {
      isValid: true,
      type: "wheel",
      offer: offer,
      couponCode: targetCode,
      minOrder: offer.minOrder,
      discount,
      value: offer.value
    };
  }

  return { isValid: false, message: "Invalid coupon code" };
};

module.exports = {
  validateAndCalculateCoupon
};
