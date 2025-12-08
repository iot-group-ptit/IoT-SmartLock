// routes/ota.js
const express = require("express");
const router = express.Router();
const OTAController = require("../controllers/otaController");
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const path = require("path");

// QUAN TRỌNG: Đổi multer để giữ nguyên tên file + đuôi .bin
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/firmware/");
  },
  filename: (req, file, cb) => {
    // Giữ nguyên tên gốc, chỉ làm sạch ký tự nguy hiểm
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, safeName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".bin") {
      return cb(new Error("Chỉ chấp nhận file .bin"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post("/upload", verifyToken, upload.single("firmware"), OTAController.upload);
router.post("/push", verifyToken, OTAController.push);
router.get("/download/:id", OTAController.download);

module.exports = router;