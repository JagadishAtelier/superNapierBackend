const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: false,
      unique: true,
      lowercase: true,
      sparse: true, // Allow multiple nulls for optional email
    },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "customer", "delivery"],
      default: "customer",
    },
    phone: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dob: { type: Date },

    // ✅ Addresses (customers usually save multiple delivery addresses)
    addresses: [
  {
    label: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    landmark: { type: String },
    isDefault: { type: Boolean, default: false },
  }
],

    // ✅ OTP Verification
    otp: { type: String },
    otpExpires: { type: Date },

    // ✅ Account status
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 🔒 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔑 Compare password method
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ phone: 1 });

module.exports = mongoose.model("User", userSchema);
