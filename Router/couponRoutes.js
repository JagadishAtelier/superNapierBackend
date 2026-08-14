const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");
const { protect, restrictToRole } = require("../middleware/auth");

// CRUD
router.post("/", protect, restrictToRole("admin"), couponController.createCoupon);
router.get("/", protect, restrictToRole("admin"), couponController.getCoupons);
router.get("/available/list", couponController.getAvailableCoupons);
router.get("/:id", protect, restrictToRole("admin"), couponController.getCouponById);
router.put("/:id", protect, restrictToRole("admin"), couponController.updateCoupon);
router.delete("/:id", protect, restrictToRole("admin"), couponController.deleteCoupon);

// Verify coupon
router.post("/verify", couponController.verifyCoupon);

module.exports = router;
