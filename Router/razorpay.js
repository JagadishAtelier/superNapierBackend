const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios"); 

const router = express.Router();
require("dotenv").config();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

const { protect } = require("../middleware/auth");
const Order = require("../Model/Order");

router.get("/key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

router.post("/create-order", protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const options = {
      amount: Math.round(order.finalAmount * 100), // convert to paise
      currency: "INR",
      receipt: `receipt_${order.orderId}`,
    };

    console.log(`Creating Razorpay order for local order: ${order.orderId}, Amount: ${options.amount}`);
    const rzpOrder = await razorpay.orders.create(options);

    order.razorpayOrderId = rzpOrder.id;
    await order.save();

    res.json({ success: true, order: rzpOrder });
  } catch (error) {
    console.error("Order creation failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_SECRET || "OJvGrVaiGKkTRa6fcCWCLWS4"
      )
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.paymentDate = new Date();
        order.razorpayPaymentId = razorpay_payment_id;
        order.paymentVerifiedAt = new Date();
        if (order.status === "pending") {
          order.status = "Processing";
        }
        await order.save();
        console.log(`✅ Order ${order.orderId} marked as PAID via verify endpoint`);
      }
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/list", async (req, res) => {
  try {
    const payments = await razorpay.payments.all({ count: 100 });
    res.json(payments.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Refund a Payment
router.post("/refund", async (req, res) => {
  try {
    const { payment_id } = req.body;
    const refund = await razorpay.payments.refund(payment_id);
    res.json(refund);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/settlements", async (req, res) => {
  try {
    const { from, to } = req.query;

    const response = await axios.get("https://api.razorpay.com/v1/settlements", {
      params: { from, to },
      auth: {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_SECRET,
      },
    });

    res.json(response.data.items || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; // ✅ CommonJS export
