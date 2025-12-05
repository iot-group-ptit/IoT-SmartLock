const express = require("express");
const router = express.Router();

const controller = require("../controllers/log.controller");

router.get("/", controller.getAllAccessLogs);

module.exports = router;
