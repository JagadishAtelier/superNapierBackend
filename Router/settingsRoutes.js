const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { protect, restrictToRole } = require("../middleware/auth");

router.get("/", settingsController.getSettings);
router.get("/states", settingsController.getStates);
router.put("/", protect, restrictToRole("admin"), settingsController.updateSettings);
router.post("/validate-coupon", settingsController.validateCoupon);
router.post("/spin-wheel", settingsController.spinWheel);

module.exports = router;
