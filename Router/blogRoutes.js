const express = require("express");
const router = express.Router();

const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog
} = require("../controllers/blogController");

// CREATE
router.post("/", createBlog);

// GET ALL
router.get("/", getAllBlogs);

// GET BY ID
router.get("/:id", getBlogById);

// UPDATE
router.put("/:id", updateBlog);

// DELETE
router.delete("/:id", deleteBlog);

module.exports = router;