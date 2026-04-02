const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

router.post("/", categoryController.createCategory);
router.get("/", categoryController.getCategories);
router.get("/lang", categoryController.getCategoriesByLang);
router.get("/:id", categoryController.getCategoryById);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

router.post("/:id/subcategory", categoryController.addSubcategory);
router.delete("/:id/subcategory/:subIndex", categoryController.removeSubcategory);

module.exports = router;
