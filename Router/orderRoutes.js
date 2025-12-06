const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { protect, protectPilot, restrictToRole } = require('../middleware/auth');

// public / user routes
router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);
router.put("/:id/adminorderstatus",orderController.updateOrderStatusByAdmin);

// these need authentication
router.get("/unclaimed", protectPilot, orderController.getOrdersbynotclaime);
router.get("/order/:userId", protect, orderController.getOrderbyuserId);

// pilot-only actions: first authenticate as pilot, then restrict by role
router.put("/:id/claim", protectPilot, restrictToRole('pilot'), orderController.claimOrder);
router.put("/:id/status", protectPilot, restrictToRole('pilot'), orderController.updateOrderStatus);
router.get("/pilot/history", protectPilot, restrictToRole('pilot'), orderController.getOrdersbypilot);

router.get("/:id", orderController.getOrderById);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);

module.exports = router;
