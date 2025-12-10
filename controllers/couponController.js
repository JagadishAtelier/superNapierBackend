const Coupon = require("../Model/CouponModel");

// Create Coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      name,
      description,
      code,
      percentage,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    // check coupon exists
    const exists = await Coupon.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: "Coupon already exists" });
    }

    const coupon = new Coupon({
      name,
      description,
      code,
      percentage,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
    });

    await coupon.save();
    res.status(201).json({ message: "Coupon created", coupon });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all coupons
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get coupon by ID
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon updated", coupon });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify Coupon
exports.verifyCoupon = async (req, res) => {
  try {
    const { code } = req.body;

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) return res.status(404).json({ message: "Invalid coupon" });

    // Check status
    if (coupon.status !== "active") {
      return res.status(400).json({ message: "Coupon is not active" });
    }

    // Check start date
    if (new Date() < coupon.startDate) {
      return res.status(400).json({ message: "Coupon is not started yet" });
    }

    // Check expiry
    if (new Date() > coupon.endDate) {
      return res.status(400).json({ message: "Coupon expired" });
    }

    // Check usage limit (if not unlimited)
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    // If everything okay, return discount
    return res.status(200).json({
      valid: true,
      discountType: "percentage",
      percentage: coupon.percentage,
      details: coupon
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAvailableCoupons = async (req, res) => {
  try {
    const today = new Date();

    const coupons = await Coupon.find({
      status: "active",
      startDate: { $lte: today },
      endDate: { $gte: today },
      $or: [
        { usageLimit: 0 }, 
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
      ]
    });

    res.status(200).json(coupons);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
