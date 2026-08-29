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
const sendEmail = require("../utils/sendEmail");
const { validateAndCalculateCoupon } = require("../services/couponService");

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
  shippingAddress: Joi.object({
    state: Joi.string().required()
  }).required().unknown(true),
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

    // 2. Check stock and calculate exact shipping using centralized backend shippingService
    const shippingService = require("../services/shippingService");
    const shippingResult = await shippingService.calculateShipping(products, shippingAddress.state);
    const calculatedShippingFee = shippingResult.totalShipping;
    const shippingLocationType = (shippingResult.region === "TN") ? "TN" : "Outside";

    for (const item of products) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const weightOption = product.weightOptions.find(
        (w) => w._id.toString() === item.weightOptionId.toString()
      );
      if (!weightOption) {
        throw new Error(`Weight option not found for product: ${product.name.en}`);
      }

      if (weightOption.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name.en} (${weightOption.weight}${weightOption.unit})`);
      }

      // Decrease stock
      await Product.updateOne(
        { _id: item.productId, "weightOptions._id": item.weightOptionId },
        { $inc: { "weightOptions.$.stock": -item.quantity } },
        { session }
      );
    }

    // 3. Coupon Validation (calculated on the backend, ignoring client-supplied discount payload)
    let coupon = null;
    let couponDiscount = 0;
    let couponSnapshot = null;

    if (couponCode) {
      const result = await validateAndCalculateCoupon(couponCode, subtotal);
      if (!result.isValid) {
        throw new Error(result.message);
      }

      couponDiscount = result.discount;
      couponSnapshot = {
        name: result.type === "promotional" ? result.model.name : result.offer.label,
        code: result.couponCode,
        percentage: result.type === "promotional" ? result.model.percentage : (result.offer.type === "percentage" ? result.offer.value : 0),
        minOrderAmount: result.minOrder,
        maxDiscountAmount: result.type === "promotional" ? result.model.maxDiscountAmount : (result.offer.maxDiscount || 0),
      };

      if (result.type === "promotional") {
        coupon = result.model;
        // Atomic conditional update to prevent usage limit race conditions
        const query = {
          _id: coupon._id,
          $or: [
            { usageLimit: 0 },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
          ]
        };
        const updated = await Coupon.findOneAndUpdate(
          query,
          { $inc: { usedCount: 1 } },
          { session, new: true }
        );
        if (!updated) {
          throw new Error("Coupon usage limit reached");
        }
      } else if (result.type === "wheel") {
        // Atomic conditional update for dynamic wheel segment to prevent usage limit race conditions
        const query = {
          settingsId: "site_settings",
          wheelOffers: {
            $elemMatch: {
              id: result.offer.id
            }
          }
        };
        if (result.offer.usageLimit > 0) {
          query.wheelOffers.$elemMatch.usedCount = { $lt: result.offer.usageLimit };
        }

        const updated = await GlobalSettings.findOneAndUpdate(
          query,
          { $inc: { "wheelOffers.$.usedCount": 1 } },
          { session, new: true }
        );
        if (!updated) {
          throw new Error("Coupon usage limit reached");
        }
      }
    }

    // 4. Build and Create Order
    const computedDiscount = couponDiscount; // Client-supplied discount parameter is completely ignored
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
      shippingBreakdown: {
        region: shippingResult.region,
        seedShipping: shippingResult.seedShipping,
        cuttingShipping: shippingResult.cuttingShipping,
        totalShipping: shippingResult.totalShipping,
        settingsSnapshot: shippingResult.settingsSnapshot
      },
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

    // Notifications (WhatsApp & Email) to Buyer
    try {
      const user = await User.findById(order.buyer);
      if (user) {
        // WhatsApp Notification
        if (user.phone) {
          try {
            await whatsappService.sendOrderNotification(user.phone, {
              id: order.orderId,
              total: order.finalAmount,
              status: order.status
            });
          } catch (wsErr) {
            console.error("WhatsApp Notification failed:", wsErr.message);
          }
        }

        // Email Notification
        const emailTo = order.buyerDetails?.email || user.email;
        if (emailTo) {
          try {
            const subject = `Order Confirmed - ${order.orderId}`;
            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #1b4332; margin-top: 0;">Order Confirmed! 🎉</h2>
                  <p style="color: #666;">Thank you for shopping with SuperNapier. Your order has been successfully placed.</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <div style="margin-bottom: 20px;">
                  <h3 style="color: #333;">Order Details</h3>
                  <p style="margin: 4px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
                  <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                  <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">Item</th>
                      <th style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">Qty</th>
                      <th style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${order.products.map(item => `
                      <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || 'Product'} ${item.weight ? `(${item.weight}${item.unit || ''})` : ''}</td>
                        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                        <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">₹${item.price * item.quantity}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                <div style="margin-bottom: 20px; text-align: right;">
                  <p style="margin: 4px 0;"><strong>Subtotal:</strong> ₹${order.subtotal}</p>
                  ${order.discount ? `<p style="margin: 4px 0; color: #dc3545;"><strong>Discount:</strong> -₹${order.discount}</p>` : ''}
                  <p style="margin: 4px 0;"><strong>Shipping Fee:</strong> ₹${order.shippingFee}</p>
                  <h3 style="margin: 8px 0 0 0; color: #1b4332;">Total: ₹${order.finalAmount}</h3>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <div>
                  <h3 style="color: #333; margin-top: 0;">Shipping Address</h3>
                  <p style="color: #666; margin: 4px 0;">${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}</p>
                  <p style="color: #666; margin: 4px 0;">${order.shippingAddress?.addressLine1 || ''} ${order.shippingAddress?.addressLine2 || ''}</p>
                  <p style="color: #666; margin: 4px 0;">${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.pincode || ''}</p>
                </div>
              </div>
            `;
            const textContent = `Order Confirmed! Thank you for shopping with SuperNapier. Order ID: ${order.orderId}. Total Amount: ₹${order.finalAmount}.`;
            await sendEmail(emailTo, subject, htmlContent, textContent);
          } catch (emailErr) {
            console.error("Order Confirmation Email failed:", emailErr.message);
          }
        }

        // Send Email to Configured Admins
        try {
          const settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
          if (settings) {
            const adminEmails = [settings.adminEmail1, settings.adminEmail2].map(e => (e || "").trim()).filter(Boolean);
            if (adminEmails.length > 0) {
              const adminSubject = `New Order Received - ${order.orderId}`;
              const adminHtmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
                  <div style="text-align: center; margin-bottom: 20px; background-color: #1b4332; color: white; padding: 15px; border-radius: 6px;">
                    <h2 style="margin: 0;">New Order Notification 📦</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Order ID: ${order.orderId}</p>
                  </div>
                  
                  <div style="margin-bottom: 20px;">
                    <h3 style="color: #1b4332; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 0;">Customer Details</h3>
                    <p style="margin: 4px 0;"><strong>Name:</strong> ${order.buyerDetails?.name || 'N/A'}</p>
                    <p style="margin: 4px 0;"><strong>Phone:</strong> ${order.buyerDetails?.phone || 'N/A'}</p>
                    <p style="margin: 4px 0;"><strong>Email:</strong> ${order.buyerDetails?.email || 'N/A'}</p>
                  </div>

                  <div style="margin-bottom: 20px;">
                    <h3 style="color: #1b4332; border-bottom: 1px solid #eee; padding-bottom: 5px;">Shipping Address</h3>
                    <p style="color: #555; margin: 4px 0;">
                      ${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}<br/>
                      ${order.shippingAddress?.addressLine1 || ''} ${order.shippingAddress?.addressLine2 || ''}<br/>
                      ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.pincode || ''}
                    </p>
                  </div>

                  <div style="margin-bottom: 20px;">
                    <h3 style="color: #1b4332; border-bottom: 1px solid #eee; padding-bottom: 5px;">Order Summary</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                      <thead>
                        <tr style="background-color: #f8f9fa;">
                          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">Item</th>
                          <th style="text-align: center; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">Qty</th>
                          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${order.products.map(item => `
                          <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${item.name || 'Product'} ${item.weight ? `(${item.weight}${item.unit || ''})` : ''}</td>
                            <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${item.quantity}</td>
                            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">₹${(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <div style="margin-bottom: 20px; text-align: right; font-size: 14px;">
                    <p style="margin: 4px 0;"><strong>Subtotal:</strong> ₹${order.subtotal.toFixed(2)}</p>
                    ${order.discount ? `<p style="margin: 4px 0; color: #dc3545;"><strong>Discount:</strong> -₹${order.discount.toFixed(2)}</p>` : ''}
                    <p style="margin: 4px 0;"><strong>Shipping Fee:</strong> ₹${order.shippingFee.toFixed(2)}</p>
                    <h3 style="margin: 8px 0 0 0; color: #1b4332;">Total Amount: ₹${order.finalAmount.toFixed(2)}</h3>
                  </div>

                  <div style="margin-bottom: 20px; background-color: #fcfcfc; padding: 12px; border: 1px dashed #ddd; border-radius: 6px;">
                    <h4 style="margin: 0 0 6px 0; color: #333;">Payment & Status</h4>
                    <p style="margin: 4px 0; font-size: 13px;"><strong>Method:</strong> ${order.paymentMethod}</p>
                    <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> ${order.paymentStatus}</p>
                  </div>

                  <div style="text-align: center; margin-top: 25px;">
                    <a href="http://localhost:5174/orders/${order._id}" style="background-color: #1b4332; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">View Order in Dashboard</a>
                  </div>
                </div>
              `;
              const adminTextContent = `New Order Received - Order ID: ${order.orderId}. Customer: ${order.buyerDetails?.name || 'N/A'}. Total: ₹${order.finalAmount}.`;
              for (const email of adminEmails) {
                try {
                  await sendEmail(email, adminSubject, adminHtmlContent, adminTextContent);
                } catch (sendErr) {
                  console.error(`Failed to send order email to admin ${email}:`, sendErr.message);
                }
              }
            }
          }
        } catch (settingsErr) {
          console.error("Configured admins notification process failed:", settingsErr.message);
        }
      }
    } catch (wsErr) {
      console.error("Notification process failed:", wsErr.message);
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

const sendOrderStatusEmail = async (order, status) => {
  try {
    const user = await User.findById(order.buyer);
    const emailTo = order.buyerDetails?.email || user?.email;
    if (!emailTo) return;

    let subject = '';
    let statusDescription = '';
    let statusTitle = '';

    switch (status) {
      case 'Processing':
        statusTitle = 'Order is Processing ⚙️';
        subject = `Your Order #${order.orderId} is being processed`;
        statusDescription = 'Great news! We have started preparing your order. We will let you know as soon as it is shipped.';
        break;
      case 'shipped':
        statusTitle = 'Order Shipped 🚚';
        subject = `Your Order #${order.orderId} has been shipped!`;
        statusDescription = 'Your package is on its way! We have dispatched it and it should reach you soon.';
        break;
      case 'delivered':
        statusTitle = 'Order Delivered 🏁';
        subject = `Your Order #${order.orderId} has been delivered`;
        statusDescription = 'Your order has been successfully delivered. We hope you enjoy your purchase! Thank you for shopping with us.';
        break;
      case 'cancelled':
        statusTitle = 'Order Cancelled ❌';
        subject = `Your Order #${order.orderId} has been cancelled`;
        statusDescription = 'Your order has been cancelled. If this was a mistake or you have questions, please reach out to our support team.';
        break;
      default:
        // Do not send emails for other status transitions
        return;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1b4332; margin-top: 0;">${statusTitle}</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">${statusDescription}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Order Summary</h3>
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="text-transform: capitalize;">${status}</span></p>
          <p style="margin: 4px 0;"><strong>Total Amount:</strong> ₹${order.finalAmount}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #999; font-size: 12px;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;
    const textContent = `Your order #${order.orderId} status update: ${status}. ${statusDescription}`;
    await sendEmail(emailTo, subject, htmlContent, textContent);
  } catch (err) {
    console.error(`Failed to send order status email for status ${status}:`, err.message);
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

    // Send order status email notification (non-blocking)
    sendOrderStatusEmail(order, status);

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

    // Send order status email notification (non-blocking)
    sendOrderStatusEmail(order, status);

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

exports.previewShipping = async (req, res, next) => {
  try {
    const { items, state } = req.body;
    if (!state) {
      return res.status(400).json({ success: false, message: "State code is required." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart items are required." });
    }

    const shippingService = require("../services/shippingService");
    const result = await shippingService.calculateShipping(items, state);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
