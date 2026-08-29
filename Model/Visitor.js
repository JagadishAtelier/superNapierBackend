const mongoose = require("mongoose");
const visitorSchema = new mongoose.Schema({
  ipAddress: { type: String, required: true },
  visitedAt: { type: Date, default: Date.now }
});
visitorSchema.index({ visitedAt: -1, ipAddress: 1 });

module.exports = mongoose.model("Visitor", visitorSchema);
