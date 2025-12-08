const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: { type: Number, default: 1 },
  price: { type: Number, required: true },       
  weightOption: {                                
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  weight: {                                       
    type: Number,
    required: false,
  },
  unit: { type: String, enum: ["g", "kg", "piece"]},
  discountPrice: {                                
    type: Number,
    required: false,
  },
  cuttingType: {
    type: String,
    default: "",
  },
}, { _id: true }); 

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
}, { timestamps: true });

module.exports = mongoose.model("Cart", cartSchema);
