const express = require("express");
const router = express.Router();
const controller = require("../controllers/stats.controller");

const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

router.get(
  "/",
  verifyToken,
  checkRole("user_manager"),
  controller.getOverviewStats
);

router.get("/admin", verifyToken, checkRole("admin"), controller.getAdminStats);

module.exports = router;
