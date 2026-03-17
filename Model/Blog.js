const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html"); // sanitize editor HTML

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  excerpt: { type: String, required: true },
  image: [{ type: String }], // multiple thumbnails or images
  content: { type: String, required: true }, // will store HTML
}, { timestamps: true });

// Pre-save hook to sanitize HTML content
blogSchema.pre("save", function(next) {
  if (this.isModified("content")) {
    this.content = sanitizeHtml(this.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "style"],
        div: ["style"],
        span: ["style"],
      },
    });
  }
  next();
});

module.exports = mongoose.model("Blog", blogSchema);