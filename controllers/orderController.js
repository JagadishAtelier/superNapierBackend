// orderController.js
const Order = require("../Model/Order");
const mongoose = require("mongoose");
const Product = require("../Model/ProductModel");

exports.createOrder = async (req, res) => {
  try {
    const {
      buyer,
      products,
      location,
      subtotal = 0,
      discount = 0,
      taxAmount = 0,
      shippingFee = 0,
      total,
      finalAmount,
      ...rest
    } = req.body;

    if (!buyer || !products?.length || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: buyer, products, or location.",
      });
    }

    // --- Check stock for each product ---
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ success: false, message: "Product not found" });
      }

      const weightOption = product.weightOptions.find(
        (w) => w._id.toString() === item.weightOptionId.toString()
      );

      if (!weightOption) {
        return res.status(400).json({ success: false, message: "Weight option not found" });
      }

      if (weightOption.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (${weightOption.weight}${weightOption.unit})`,
        });
      }
    }

    // --- Decrease stock ---
    for (const item of products) {
      await Product.updateOne(
        { _id: item.productId, "weightOptions._id": item.weightOptionId },
        { $inc: { "weightOptions.$.stock": -item.quantity } }
      );
    }

    // --- Create order ---
    
    const computedTotal = typeof total === "number" ? total : products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const computedFinalAmount = typeof finalAmount === "number" ? finalAmount : computedTotal - discount + taxAmount + shippingFee;

    const orderData = {
      buyer,
      products,
      subtotal,
      location,
      discount,
      taxAmount,
      shippingFee,
      total: computedTotal,
      finalAmount: computedFinalAmount,
      ...rest,
    };

    const order = await Order.create(orderData);

    // Emit real-time updates if io exists (your existing code)
    const io = req.app?.locals?.io;
    if (io) {
      io.to("admins").emit("newOrder", {
        _id: order._id,
        orderId: order.orderId,
        buyer: order.buyer,
        total: order.total,
        finalAmount: order.finalAmount,
        status: order.status,
        createdAt: order.createdAt,
      });
    }

    return res.status(201).json({ success: true, message: "Order created successfully ✅", data: order });
  } catch (err) {
    console.error("Order creation failed:", err);
    return res.status(500).json({ success: false, error: err.message });
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
    const allowed = ["pending", "claimed", "reached_pickup", "picked_up", "delivered", "cancelled"];
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
