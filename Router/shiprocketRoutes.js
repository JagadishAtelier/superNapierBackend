const express = require("express");
const router = express.Router();
const controller = require("../controllers/shiprocketController");
const { protect, restrictToRole } = require("../middleware/auth");

router.post("/auth", protect, restrictToRole("admin"), controller.login);
router.get("/orders", protect, restrictToRole("admin"), controller.getOrders);
router.post("/assign-awb", protect, restrictToRole("admin"), controller.assignAwb);
router.post("/schedule-pickup", protect, restrictToRole("admin"), controller.schedulePickup);
router.get("/track/:id", protect, restrictToRole("admin"), controller.trackShipment);
router.get("/label/:id", protect, restrictToRole("admin"), controller.getLabel);

module.exports = router;
