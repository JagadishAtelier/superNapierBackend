const express = require("express");
const router = express.Router();
const shareController = require("../controllers/shareController");

// Public social sharing gateway for products
router.get("/product/:id", shareController.renderProductSharePage);

module.exports = router;
