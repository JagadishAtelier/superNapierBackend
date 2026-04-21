const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true },
      ta: { type: String },
      hi: { type: String },
      te: { type: String },
      kn: { type: String },
      ml: { type: String },
    },
    image: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);