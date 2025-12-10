const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");

// CRUD
router.post("/", couponController.createCoupon);
router.get("/", couponController.getCoupons);
router.get("/available/list", couponController.getAvailableCoupons);
router.get("/:id", couponController.getCouponById);
router.put("/:id", couponController.updateCoupon);
router.delete("/:id", couponController.deleteCoupon);

// Verify coupon
router.post("/verify", couponController.verifyCoupon);

module.exports = router;
