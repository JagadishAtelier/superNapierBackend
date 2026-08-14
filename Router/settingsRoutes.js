const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { protect, restrictToRole } = require("../middleware/auth");

router.get("/", settingsController.getSettings);
router.put("/", protect, restrictToRole("admin"), settingsController.updateSettings);

module.exports = router;
