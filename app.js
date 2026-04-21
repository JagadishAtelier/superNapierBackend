const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const productRoutes = require("./Router/productRoutes");
const dashboardRoutes = require("./Router/dashboardRoutes");
const pincodeRoutes = require("./Router/pincodeRoutes");
const orderRoutes = require("./Router/orderRoutes");
const notificationRoutes = require("./Router/notificationRoutes");
const analyticsRoutes = require("./Router/analyticsRoutes");
const campaignRoutes = require("./Router/campaignRoutes");
const shiprocketRoutes = require("./Router/shiprocketRoutes");
const authRoutes = require("./Router/authRoutes")
const categoryRoutes = require("./Router/categoryRoutes");
const razorpay = require("./Router/razorpay");
const shippingAnalyticsRoutes = require("./Router/shippingAnalyticsRoutes");
const cartRoutes = require('./Router/cartRoutes')
const pilotRoutes = require('./Router/pilotuserRoutes')
const otpRoutes = require('./Router/otpRoutes')
const couponRoutes = require("./Router/couponRoutes");
const blogRoutes = require("./Router/blogRoutes");
const razorpayWebhook = require("./Router/razorpayWebhook");
const cors = require("cors")
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();
require("dotenv").config();

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
});

// Apply limiter to auth routes
app.use("/api/auth", limiter);

// Webhooks
app.use("/api/webhooks/razorpay", razorpayWebhook);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors({
  origin: "*",  // allows requests from any domain
  credentials: true, // optional: only needed if you use cookies or auth headers
}));
app.use(morgan('dev'));
// Routes
app.use("/api/categories", categoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use("/api/analytics", shippingAnalyticsRoutes);
app.use("/api/shiprocket", shiprocketRoutes);
app.use("/api/products", productRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/pincodes", pincodeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", razorpay);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/pilot", pilotRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/blog", blogRoutes);

// Global Error Handler (Must be after all routes)
app.use(errorHandler);

module.exports = app;
