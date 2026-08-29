const mongoose = require("mongoose");

const pageContentSchema = new mongoose.Schema(
  {
    pageId: { 
      type: String, 
      required: true, 
      unique: true, 
      enum: ["about", "partnership"] 
    },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
      ogTitle: { type: String, default: "" },
      ogDescription: { type: String, default: "" },
      ogImage: { type: String, default: "" },
      jsonLd: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    updatedBy: { type: String, default: "admin" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PageContent", pageContentSchema);
