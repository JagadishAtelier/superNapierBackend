const mongoose = require("mongoose");

const pincodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g., 641011
  area: { type: String, required: true }, // e.g., Saibaba Colony
});

module.exports = ("Pincode", pincodeSchema);
