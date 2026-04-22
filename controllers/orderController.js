// orderController.js
const Order = require("../Model/Order");
const mongoose = require("mongoose");
const Product = require("../Model/ProductModel");
const Coupon = require("../Model/CouponModel");
const webpush = require("../services/notifications");
const Subscription = require("../Model/Subscription");
const User = require("../Model/User");
const whatsappService = require("../utils/whatsappService");
const GlobalSettings = require("../Model/GlobalSettings");

const Joi = require("joi");

// Validation Schema
const createOrderSchema = Joi.object({
  buyer: Joi.string().required(),
  products: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    weightOptionId: Joi.string().required(),
    quantity: Joi.number().min(1).required(),
    price: Joi.number().required(),
    name: Joi.string().optional(),
    weight: Joi.number().optional(),
    unit: Joi.string().optional(),
    cuttingType: Joi.string().allow("").optional()
  })).min(1).required(),
  location: Joi.string().required(),
  subtotal: Joi.number().required(),
  discount: Joi.number().default(0),
  taxAmount: Joi.number().default(0),
  shippingFee: Joi.number().default(0),
  shippingType: Joi.string().valid("Normal", "Express").default("Normal"),
  total: Joi.number().required(),
  finalAmount: Joi.number().required(),
  couponCode: Joi.string().allow("").optional(),
  paymentMethod: Joi.string().valid("COD", "online", "UPI").required(),
  paymentProof: Joi.object({
    screenshot: Joi.string().allow("").optional(),
    transactionId: Joi.string().allow("").optional()
  }).optional(),
  shippingAddress: Joi.object().optional(),
}).unknown(true);

exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Validate Input
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const {
      buyer,
      products,
      location,
      subtotal,
      discount,
      taxAmount,
      shippingFee,
      shippingType,
      total,
      finalAmount,
      couponCode,
      shippingAddress,
      paymentMethod,
      ...rest
    } = value;

    // 2. Check stock and calculate exact shipping
    let calculatedShippingFee = 0;
    const state = shippingAddress?.state?.toLowerCase() || "";
    const isTamilNadu = state.includes("tamil") || state.trim() === "tn";
    const shippingLocationType = isTamilNadu ? "TN" : "Outside";
    
    let maxShippingFound = 0;

    for (const item of products) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Calculate regional shipping for this product
      let productShipping = 0;
      if (shippingType === "Express") {
        productShipping = isTamilNadu ? (product.shippingExpressTN || 0) : (product.shippingExpressOutside || 0);
      } else {
        productShipping = isTamilNadu ? (product.shippingNormalTN || 0) : (product.shippingNormalOutside || 0);
      }
      
      if (productShipping > maxShippingFound) {
        maxShippingFound = productShipping;
      }

      const weightOption = product.weightOptions.find(
        (w) => w._id.toString() === item.weightOptionId.toString()
      );
      if (!weightOption) {
        throw new Error(`Weight option not found for product: ${product.name}`);
      }

      if (weightOption.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (${weightOption.weight}${weightOption.unit})`);
      }
      // Decrease stock
      await Product.updateOne(
        { _id: item.productId, "weightOptions._id": item.weightOptionId },
        { $inc: { "weightOptions.$.stock": -item.quantity } },
        { session }
      );
    }

    // 3. Fetch Settings for Dynamic Threshold
    const settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
    const freeShippingThreshold = settings?.freeShippingThreshold || 999;

    // 4. Calculate Shipping Fee with Fallbacks
    if (subtotal >= freeShippingThreshold) {
      calculatedShippingFee = 0;
    } else if (maxShippingFound === 0) {
      // Fallback fees matching frontend if no product-specific shipping is set
      if (isTamilNadu) {
        calculatedShippingFee = (shippingType === "Express") ? 80 : 50;
      } else {
        calculatedShippingFee = (shippingType === "Express") ? 150 : 100;
      }
    } else {
      calculatedShippingFee = maxShippingFound;
    }

    // 3. Coupon Validation
    let coupon = null;
    let couponDiscount = 0;
    let couponSnapshot = null;

    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase() }).session(session);

      if (!coupon) throw new Error("Invalid coupon code");
      if (coupon.status !== "active") throw new Error("Coupon is not active");

      const now = new Date();
      if (now < coupon.startDate || now > coupon.endDate) throw new Error("Coupon expired or not started");
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new Error("Coupon usage limit reached");
      if (subtotal < coupon.minOrderAmount) throw new Error(`Minimum order amount ₹${coupon.minOrderAmount} required`);

      couponDiscount = Math.min((subtotal * coupon.percentage) / 100, coupon.maxDiscountAmount || Infinity);
      
      couponSnapshot = {
        name: coupon.name,
        code: coupon.code,
        percentage: coupon.percentage,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
      };

      // Increase coupon usage
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } }, { session });
    }

    // 4. Build and Create Order
    const computedDiscount = discount + couponDiscount;
    const finalTotal = subtotal - computedDiscount + taxAmount + calculatedShippingFee;

    const orderData = {
      buyer,
      products,
      subtotal,
      location,
      discount: computedDiscount,
      taxAmount,
      shippingFee: calculatedShippingFee,
      shippingLocationType,
      shippingType,
      total: finalTotal,
      finalAmount: finalTotal,
      notification_read: false,
      paymentMethod,
      shippingAddress,
      ...rest,
    };

    if (paymentMethod === "UPI") {
      orderData.paymentStatus = "awaiting_verification";
    }

    if (coupon) {
      orderData.coupon = coupon._id;
      orderData.couponSnapshot = couponSnapshot;
      orderData.couponDiscount = couponDiscount;
      orderData.couponAppliedAt = new Date();
    }

    const [order] = await Order.create([orderData], { session });

    // 5. Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // 6. Post-order actions (Async, non-blocking)
    const io = req.app?.locals?.io;
    if (io) {
      io.to("admins").emit("newOrder", {
        _id: order._id,
        orderId: order.orderId,
        buyer: order.buyer,
        total: order.total,
        finalAmount: order.finalAmount,
        status: order.status,
        notification_read: order.notification_read,
        createdAt: order.createdAt,
      });
    }

    // WhatsApp Notification to Buyer
    try {
      const user = await User.findById(order.buyer);
      if (user && user.phone) {
        await whatsappService.sendOrderNotification(user.phone, {
          id: order.orderId,
          total: order.finalAmount,
          status: order.status
        });
      }
    } catch (wsErr) {
      console.error("WhatsApp Notification failed:", wsErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully ✅",
      data: order,
    });

  } catch (err) {
    // Abort Transaction on error
    await session.abortTransaction();
    session.endSession();
    next(err); // Pass to global error handler
  }
};

// 📌 Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("buyer", "name email")
      .populate("products.productId", "name price images")
      .populate("claimedBy", "name email phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 📌 Get a single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email")
      .populate("products.productId", "name price images");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOrderbyuserId = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.params.userId })
      .populate("buyer", "name email address")
      .populate("products.productId", "name price images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 📌 Update an order by ID
exports.updateOrder = async (req, res) => {
  try {
    // If updating total/discount/taxes/shipping, recalc finalAmount if not explicitly provided
    if ((req.body.total || req.body.discount || req.body.taxAmount || req.body.shippingFee) && typeof req.body.finalAmount !== "number") {
      req.body.finalAmount = (req.body.total ?? 0) - (req.body.discount ?? 0) + (req.body.taxAmount ?? 0) + (req.body.shippingFee ?? 0);
    }

    // use findByIdAndUpdate (fix bug where code used { id: req.params.id })
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("buyer", "name email")
      .populate("products.productId", "name price");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 📌 Delete an order by ID
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 📌 Get all unclaimed orders (for pilots)
exports.getOrdersbynotclaime = async (req, res) => {
  try {
    const orders = await Order.find({ claimedBy: null })
      .populate("buyer")
      .populate("products.productId", "name price")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });

    // ✅ Real-time push to pilots
    try {
      const io = req.app?.locals?.io;
      if (io) {
        io.to("pilots").emit("ordersUpdate", {
          orders: orders.map((o) => ({
            _id: o._id,
            orderId: o.orderId,
            total: o.total,
            finalAmount: o.finalAmount,
            itemsCount: o.products?.length || 0,
            createdAt: o.createdAt,
            status: o.status,
          })),
        });
      }
    } catch (emitErr) {
      console.error("Socket emit failed:", emitErr);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// �� Claim an order (REST) — now atomic using findOneAndUpdate
exports.claimOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const pilotId = req.pilot?.id;
    if (!pilotId) {
      return res.status(401).json({ success: false, message: "Pilot auth required" });
    }

    const ObjectId = mongoose.Types.ObjectId;
    const now = new Date();
    const claimDurationMs = 2 * 60 * 1000;
    const claimExpiresAt = new Date(now.getTime() + claimDurationMs);

    // Option 1 (recommended): let Mongoose cast the string -> ObjectId
    const claimed = await Order.findOneAndUpdate(
      {
        _id: orderId, // pass string, mongoose will cast
        $or: [
          { claimedBy: null },
          { claimExpiresAt: { $lte: new Date() } },
          { claimExpiresAt: null }
        ],
        status: "pending",
      },
      {
        $set: {
          claimedBy: pilotId, // pass string, mongoose will cast
          claimedAt: now,
          claimExpiresAt,
          status: "claimed",
        },
      },
      { new: true }
    )

      .populate("buyer", "name email")
      .populate("products.productId", "name price");

    if (!claimed) {
      return res.status(400).json({ success: false, message: "Already claimed or unavailable" });
    }


    res.json({ success: true, data: claimed });

    // emit updates
    try {
      const io = req.app?.locals?.io;
      if (io) {
        io.to("pilots").emit("orderClaimed", { orderId: claimed.orderId, claimedBy: pilotId });
        io.to(`pilot_${pilotId}`).emit("orderAssigned", { order: claimed });
        io.to("admins").emit("orderClaimed", { orderId: claimed.orderId, claimedBy: pilotId });
      }
    } catch (emitErr) {
      console.error("Socket emit failed:", emitErr);
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    // allowed statuses must match schema
    const allowed = ["pending","Processing", "claimed", "reached_pickup","shipped", "picked_up", "delivered", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.claimedBy && ["reached_pickup", "picked_up", "delivered"].includes(status)) {
      return res.status(400).json({ success: false, message: "This order is not claimed" });
    }

    order.status = status;
    if (status === "delivered") order.deliveredAt = new Date();
    if (status === "cancelled") order.cancelledAt = new Date();

    await order.save();

    res.json({ success: true, data: order });

    // -------------------------
    // Real-time notifications
    // -------------------------
    const io = req.app?.locals?.io;
    if (io) {
      const eventMap = {
        reached_pickup: "orderReached",
        picked_up: "orderPickedUp",
        delivered: "orderDelivered",
      };

      const eventName = eventMap[status];
      if (eventName) {
        io.to(`pilot_${order.claimedBy}`).emit(eventName, { orderId: order.orderId });
        io.to("admins").emit(eventName, { orderId: order.orderId, claimedBy: order.claimedBy });
      }
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateOrderStatusByAdmin = async (req, res) => {
  try {
    console.log("🟡 updateOrderStatusByAdmin started");

    const { status } = req.body;
    console.log("🔹 Requested Status:", status);

    const allowedStatuses = ["pending", "Processing", "shipped", "delivered", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      console.log("❌ Invalid status received:", status);
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    console.log("🔹 Found Order:", order?._id);

    if (!order) {
      console.log("❌ Order not found:", req.params.id);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.status = status;
    if (status === "delivered") order.deliveredAt = new Date();
    if (status === "cancelled") order.cancelledAt = new Date();

    await order.save();

    console.log("✅ Order updated successfully:", order.orderId);

    // Send response early
    res.json({ success: true, data: order });

    // ==================================================
    // SEND PUSH TO BUYER USING Subscription COLLECTION
    // ==================================================
    console.log("🔔 PUSH PROCESS STARTED -----");

    try {
      // ensure buyer is string
      const buyerId = order.buyer ? order.buyer.toString() : null;
      console.log("👤 Buyer ID:", buyerId);

      if (!buyerId) {
        console.log("❌ No Buyer ID found in order, abort push");
        return;
      }

      const subs = await Subscription.find({ user: buyerId });
      console.log("📦 Subscriptions found:", subs.length);

      if (!subs || subs.length === 0) {
        console.log("❌ No Subscription found for this buyer");
        return;
      }

      const payload = JSON.stringify({
        title: "Order Update",
        body: `Your order ${order.orderId} is now ${status}`,
        orderId: order._id,
        status,
      });

      console.log("📨 Payload ready:", payload);

      await Promise.all(
        subs.map(async (sub) => {
          console.log("➡ Sending push to endpoint:", sub.endpoint);
          try {
            await webpush.sendNotification(sub, payload);
            console.log("✅ Push sent to:", sub.endpoint);
          } catch (err) {
            console.log("🚨 Push Error for", sub.endpoint, ":", err?.message || err);
            if (err && (err.statusCode === 410 || err.statusCode === 404)) {
              try {
                await Subscription.deleteOne({ _id: sub._id });
                console.log("🗑️ Removed expired subscription:", sub.endpoint);
              } catch (delErr) {
                console.log("Failed to remove subscription:", delErr?.message || delErr);
              }
            }
          }
        })
      );

      console.log("🎉 All push attempts completed");
    } catch (pushErr) {
      console.log("🚨 PUSH PROCESS FAILED:", pushErr?.message || pushErr);
    }

    // WhatsApp Notification on Status Update
    try {
      const user = await User.findById(order.buyer);
      if (user && user.phone) {
        await whatsappService.sendTemplate(user.phone, 'order_status_update', [
          order.orderId,
          status
        ]);
      }
    } catch (wsErr) {
      console.error("WhatsApp Status Notification failed:", wsErr.message);
    }
  } catch (err) {
    console.log("🔥 Controller Error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
};


// �� Get orders for a pilot
exports.getOrdersbypilot = async (req, res) => {
  try {
    const orders = await Order.find({ claimedBy: req.pilot.id })
      .populate("buyer", "name email")
      .populate("products.productId", "name price")
      .populate("claimedBy", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });

    // ✅ Real-time push to pilots (optional)
    try {
      const io = req.app?.locals?.io;
      if (io) {
        io.to("pilots").emit("ordersUpdate", {
          orders: orders.map((o) => ({
            _id: o._id,
            orderId: o.orderId,
            total: o.total,
            finalAmount: o.finalAmount,
            itemsCount: o.products?.length || 0,
            createdAt: o.createdAt,
            status: o.status,
          })),
        });
      }
    } catch (emitErr) {
      console.error("Socket emit failed:", emitErr);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// 📌 Get unread notification orders
exports.getUnreadOrders = async (req, res) => {
  try {
    const orders = await Order.find({ notification_read: false })
      .populate("buyer", "name email")
      .populate("products.productId", "name price images")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: orders });
  } catch (err) {
    console.log("🔴 getUnreadOrders error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};


// 📌 Mark order notification as read
exports.markOrderAsRead = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { notification_read: true },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
      data: order,
    });
  } catch (err) {
    console.log("🔴 markOrderAsRead error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
};
