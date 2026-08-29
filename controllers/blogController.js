const Blog = require("../Model/Blog");
const sanitizeHtml = require("sanitize-html");

// ✅ CREATE BLOG (POST) - Single + Multiple
exports.createBlog = async (req, res) => {
  try {
    const data = req.body;

    // 🔁 If multiple blogs
    if (Array.isArray(data)) {
      const formattedData = data.map(item => ({
        title: item.title,
        date: item.date,
        excerpt: item.excerpt,
        content: sanitizeHtml(item.content || "", {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img","h1","h2","h3","h4","h5","h6","span","div"
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ["src","alt","style"],
            div: ["style"],
            span: ["style"]
          }
        }),
        image: Array.isArray(item.image)
          ? item.image
          : item.image
          ? [item.image]
          : [],
        metaKeywords: item.metaKeywords,
        taggedProducts: item.taggedProducts || [],
        whatsappCTA: item.whatsappCTA || false,
        whatsappCTAText: item.whatsappCTAText || "Inquire on WhatsApp",
        whatsappCTAMessage: item.whatsappCTAMessage
      }));

      const savedBlogs = await Blog.insertMany(formattedData);

      return res.status(201).json({
        success: true,
        message: "Multiple blogs created successfully",
        data: savedBlogs
      });
    }

    // 🔁 If single blog
    const { title, date, excerpt, content, image, metaKeywords, taggedProducts, whatsappCTA, whatsappCTAText, whatsappCTAMessage } = data;

    const newBlog = new Blog({
      title,
      date,
      excerpt,
      content: sanitizeHtml(content || "", {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img","h1","h2","h3","h4","h5","h6","span","div"
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ["src","alt","style"],
          div: ["style"],
          span: ["style"]
        }
      }),
      image: Array.isArray(image) ? image : image ? [image] : [],
      metaKeywords,
      taggedProducts: taggedProducts || [],
      whatsappCTA: whatsappCTA || false,
      whatsappCTAText: whatsappCTAText || "Inquire on WhatsApp",
      whatsappCTAMessage
    });

    const savedBlog = await newBlog.save();

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: savedBlog
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET ALL BLOGS
exports.getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().populate("taggedProducts").sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: blogs.length, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET BLOG BY ID
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate("taggedProducts");
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE BLOG (PUT)
exports.updateBlog = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      content: sanitizeHtml(req.body.content || "", {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img","h1","h2","h3","h4","h5","h6","span","div"
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ["src","alt","style"],
          div: ["style"],
          span: ["style"]
        }
      }),
      image: req.body.image || []
    };

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedBlog) return res.status(404).json({ success: false, message: "Blog not found" });

    res.status(200).json({ success: true, message: "Blog updated successfully", data: updatedBlog });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ DELETE BLOG
exports.deleteBlog = async (req, res) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};