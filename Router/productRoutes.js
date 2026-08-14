const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { protect, restrictToRole } = require("../middleware/auth");

router.post("/", protect, restrictToRole("admin"), productController.createProduct);
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);
router.get("/category/:category", productController.getProductsByCategory);
router.put("/:id", protect, restrictToRole("admin"), productController.updateProduct);
router.delete("/:id", protect, restrictToRole("admin"), productController.deleteProduct);

module.exports = router;
    