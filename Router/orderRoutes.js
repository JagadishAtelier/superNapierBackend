const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { protect, restrictToRole } = require("../middleware/auth");

// --- Specific endpoints first ---
router.post("/preview-shipping", orderController.previewShipping);
router.get("/unread", protect, restrictToRole('admin'), orderController.getUnreadOrders);          
router.patch("/:id/read", protect, restrictToRole('admin'), orderController.markOrderAsRead);     
router.put("/:id/adminorderstatus", protect, restrictToRole('admin'), orderController.updateOrderStatusByAdmin); 

// --- Generic endpoints ---
router.get("/", protect, restrictToRole('admin'), orderController.getOrders);                     
router.post("/", protect, orderController.createOrder); // Protect so we know who the 'buyer' is

router.get("/:id", protect, orderController.getOrderById);               
router.put("/:id", protect, restrictToRole('admin'), orderController.updateOrder);                
router.delete("/:id", protect, restrictToRole('admin'), orderController.deleteOrder);             

// Roles
router.get("/pilot/:pilotId", protect, restrictToRole('delivery', 'admin'), orderController.getOrdersbypilot);
router.get("/user/:userId", protect, orderController.getOrderbyuserId);
router.get("/unclaimed", protect, restrictToRole('delivery', 'admin'), orderController.getOrdersbynotclaime);
router.patch("/:id/claim", protect, restrictToRole('delivery'), orderController.claimOrder);         

module.exports = router;
