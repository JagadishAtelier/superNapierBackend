const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Model/User');
const sendEmail = require('../utils/sendEmail');
const whatsappService = require('../utils/whatsappService');
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

exports.register = async function (req, res) {
  try {
    const { name, email, phone, password, role = 'customer' } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }

    // Check for existing user
    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });

    const existingUser = await User.findOne({ $or: query });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or phone already exists' });
    }

    const newUser = new User({ name, email, phone, password, role });
    await newUser.save();

    res.status(201).json({ 
      success: true,
      message: 'User registered successfully',
      user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.login = async function (req, res) {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginIdentifier = identifier || email || phone;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Identifier (email or phone) and password are required' });
    }

    // Search by email OR phone
    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { phone: loginIdentifier }]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const responseUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      address: user.addresses && user.addresses.length > 0 ? user.addresses[0] : null,
    };

    res.status(200).json({
      success: true,
      token,
      user: responseUser,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { identifier, email, phone } = req.body; 
    const loginIdentifier = identifier || email || phone;

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { phone: loginIdentifier }]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; 
    await user.save();

    if (user.phone) {
      // Send via WhatsApp
      await whatsappService.sendOTP(user.phone, otp);
      return res.json({ success: true, message: 'OTP sent to your WhatsApp', method: 'whatsapp' });
    } else if (user.email) {
      // Fallback to Email
      const subject = 'Your Password Reset OTP';
      const htmlContent = `<h1>OTP: ${otp}</h1><p>Expires in 10 minutes.</p>`;
      const textContent = `Your password reset OTP is: ${otp}. It expires in 10 minutes.`;
      await sendEmail(user.email, subject, htmlContent, textContent);
      return res.json({ success: true, message: 'OTP sent to your email', method: 'email' });
    }

    res.status(400).json({ message: 'No contact method found for this user' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { identifier, email, phone, otp, newPassword } = req.body;
    const loginIdentifier = identifier || email || phone;

    const user = await User.findOne({ 
      $or: [{ email: loginIdentifier }, { phone: loginIdentifier }],
      otp, 
      otpExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user profile', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone, addresses } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;

    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists && exists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }

    if (typeof addresses !== 'undefined') {
      if (!Array.isArray(addresses)) return res.status(400).json({ message: 'Addresses must be an array' });
      user.addresses = addresses;
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ success: true, message: 'Profile updated successfully', user: userObj });
  } catch (err) {
    return res.status(500).json({ message: 'Update failed', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Old password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -otp -otpExpires");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user", error: err.message });
  }
};
