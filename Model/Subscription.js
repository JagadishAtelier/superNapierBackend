const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, unique: true },
  keys: {
    p256dh: String,
    auth: String,

  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);
