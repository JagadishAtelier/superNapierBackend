// Order.js
const mongoose = require("mongoose");


const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., "orderId"
  seq: { type: Number, default: 0 },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },

    // 🔹 Buyer info
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyerDetails: {
      name: String,
      email: String,
      phone: String,
    },

    // 🔹 Shipping info
    shippingAddress: {
      firstName: String,
      lastName: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },

    location: { type: String, required: true },
    deliveryInstructions: { type: String },

    // 🔹 Order status lifecycle (machine-friendly values)
    status: {
      type: String,
      enum: [
        "pending",
        "claimed",
        "Processing",
        "reached_pickup",
        "picked_up",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    // 🔹 Payment info
    paymentMethod: {
      type: String,
      enum: ["COD", "online"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentDate: Date,
    paymentVerifiedAt: Date,

    // Razorpay integration
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    // 🔹 Products
    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String, // optional snapshot
        weight: Number,
        unit: { type: String, enum: ["g", "kg", "piece"]},
        price: Number,
        quantity: { type: Number, default: 1 },
      },
    ],

    // 🔹 Pricing breakdown
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },

    // make total/finalAmount safe (defaults), so controller can compute them if missing
    total: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },

    // 🔹 GST / Business info
    gstNumber: String,
    companyName: String,
    invoiceUrl: String,

    // 🔹 Geo + assignment
    pingLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    pingedAt: Date,

    // 🔹 Delivery lifecycle timestamps
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "PilotUser", default: null },
    claimedAt: { type: Date, default: null },
    claimExpiresAt: { type: Date, default: null },
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);
const Counter = mongoose.model("Counter", counterSchema);

orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "orderId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const seqNumber = counter.seq.toString().padStart(5, "0"); // e.g., 00001
      this.orderId = `ORD${seqNumber}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});


// 🗺️ Indexes
orderSchema.index({ pingLocation: "2dsphere" });
orderSchema.index({ status: 1, claimExpiresAt: 1 });

// 🧾 Auto-generate orderId
orderSchema.pre("save", function (next) {
  if (!this.orderId) {
    this.orderId = `ORD${Date.now()}`;
  }
  next();
});

// 🛠️ Static helpers
orderSchema.statics.claimOrder = async function (orderIdOrId, pilotId, claimDurationMs = 2 * 60 * 1000) {
  const ObjectId = mongoose.Types.ObjectId;
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + claimDurationMs);

  const queryBase = {
    $and: [
      { $or: [{ claimedBy: null }, { claimExpiresAt: { $lte: new Date() } }, { claimExpiresAt: null }] },
      { status: "pending" },
    ],
  };

  const query = ObjectId.isValid(orderIdOrId)
    ? { _id: ObjectId(orderIdOrId), ...queryBase }
    : { orderId: orderIdOrId, ...queryBase };

  const updated = await this.findOneAndUpdate(
    query,
    {
      $set: {
        claimedBy: ObjectId(pilotId),
        claimedAt: now,
        claimExpiresAt,
        status: "claimed",
      },
    },
    { new: true }
  )
    .populate("buyer", "name email")
    .populate("claimedBy", "name email")
    .lean();

  return updated;
};

orderSchema.statics.releaseClaim = async function (orderIdOrId, pilotId) {
  const ObjectId = mongoose.Types.ObjectId;
  const query = ObjectId.isValid(orderIdOrId)
    ? { _id: ObjectId(orderIdOrId), claimedBy: ObjectId(pilotId) }
    : { orderId: orderIdOrId, claimedBy: ObjectId(pilotId) };

  return this.findOneAndUpdate(
    query,
    {
      $set: {
        claimedBy: null,
        claimedAt: null,
        claimExpiresAt: null,
        status: "pending",
      },
    },
    { new: true }
  );
};

module.exports = mongoose.model("Order", orderSchema);
