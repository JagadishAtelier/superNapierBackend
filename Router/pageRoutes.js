const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { protect, restrictToRole } = require("../middleware/auth");

router.get("/:pageId", pageController.getPageContent);
router.put("/:pageId", protect, restrictToRole("admin"), pageController.updatePageContent);

module.exports = router;
