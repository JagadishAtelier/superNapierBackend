const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { protect, restrictToRole } = require("../middleware/auth");

router.post("/", protect, restrictToRole("admin"), categoryController.createCategory);
router.get("/", categoryController.getCategories);
router.get("/lang", categoryController.getCategoriesByLang);
router.get("/:id", categoryController.getCategoryById);
router.put("/:id", protect, restrictToRole("admin"), categoryController.updateCategory);
router.delete("/:id", protect, restrictToRole("admin"), categoryController.deleteCategory);

router.post("/:id/subcategory", protect, restrictToRole("admin"), categoryController.addSubcategory);
router.delete("/:id/subcategory/:subIndex", protect, restrictToRole("admin"), categoryController.removeSubcategory);

module.exports = router;
