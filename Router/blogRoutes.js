const express = require("express");
const router = express.Router();
const { protect, restrictToRole } = require("../middleware/auth");

const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog
} = require("../controllers/blogController");

// CREATE
router.post("/", protect, restrictToRole("admin"), createBlog);

// GET ALL
router.get("/", getAllBlogs);

// GET BY ID
router.get("/:id", getBlogById);

// UPDATE
router.put("/:id", protect, restrictToRole("admin"), updateBlog);

// DELETE
router.delete("/:id", protect, restrictToRole("admin"), deleteBlog);

module.exports = router;