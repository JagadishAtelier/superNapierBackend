// routes/orderRoutes.js  (example file)
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// --- Specific endpoints first ---
router.get("/unread", orderController.getUnreadOrders);          // GET /api/orders/unread
router.patch("/:id/read", orderController.markOrderAsRead);     // PATCH /api/orders/:id/read
router.put("/:id/adminorderstatus", orderController.updateOrderStatusByAdmin); // keep admin route specific

// --- Then the generic :id endpoints ---
router.get("/", orderController.getOrders);                     // GET /api/orders
router.post("/", orderController.createOrder);                  // POST /api/orders

// Routes using :id must come AFTER specific ones so 'unread' won't match here
router.get("/:id", orderController.getOrderById);               // GET /api/orders/:id
router.put("/:id", orderController.updateOrder);                // PUT /api/orders/:id
router.delete("/:id", orderController.deleteOrder);             // DELETE /api/orders/:id

// pilot-specific and other routes (keep order mindful)
router.get("/pilot/:pilotId", orderController.getOrdersbypilot);
router.get("/user/:userId", orderController.getOrderbyuserId);
router.get("/unclaimed", orderController.getOrdersbynotclaime);
router.patch("/:id/claim", orderController.claimOrder);         // if you have claim route like this

module.exports = router;
