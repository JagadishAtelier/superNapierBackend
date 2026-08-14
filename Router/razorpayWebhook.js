const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../Model/Order");
const Product = require("../Model/ProductModel");
const whatsappService = require("../utils/whatsappService");

// Razorpay Webhook Secret (Set this in your .env)
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

router.post("/", async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // 1. Verify Signature using raw body buffer
    if (!req.rawBody) {
      return res.status(400).json({ success: false, message: "Raw body missing for signature verification" });
    }
    const shasum = crypto.createHmac("sha256", WEBHOOK_SECRET);
    shasum.update(req.rawBody);
    const digest = shasum.digest("hex");

    if (signature !== digest) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body.event;
    console.log("🔔 Razorpay Webhook Event:", event);

    // 2. Handle Events
    if (event === "order.paid" || event === "payment.captured") {
      const payload = req.body.payload.payment.entity;
      const razorpayOrderId = payload.order_id;
      const razorpayPaymentId = payload.id;

      // Find order by razorpayOrderId
      const order = await Order.findOne({ razorpayOrderId });

      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.paymentDate = new Date();
        order.razorpayPaymentId = razorpayPaymentId;
        order.paymentVerifiedAt = new Date();
        
        // Update status to Processing if it was pending
        if (order.status === "pending") {
            order.status = "Processing";
        }

        await order.save();
        console.log(`✅ Order ${order.orderId} marked as PAID via Webhook`);

        // 3. Send WhatsApp Notification
        const phone = order.buyerDetails?.phone;
        if (phone) {
          // Format phone to E.164 without + (assuming India +91 if length is 10)
          let formattedPhone = phone.replace(/\D/g, "");
          if (formattedPhone.length === 10) {
            formattedPhone = "91" + formattedPhone;
          }
          
          await whatsappService.sendOrderNotification(formattedPhone, {
            id: order.orderId,
            total: order.finalAmount || order.total,
            status: order.status
          });
        }

        // Emit real-time update to admins
        const io = req.app?.locals?.io;
        if (io) {
            io.to("admins").emit("orderUpdated", {
                _id: order._id,
                orderId: order.orderId,
                paymentStatus: "paid",
                status: order.status
            });
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    next(err);
  }
});

module.exports = router;
