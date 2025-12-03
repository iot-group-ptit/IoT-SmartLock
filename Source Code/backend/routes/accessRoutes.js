const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');
const { accessLimiter } = require('../middleware/rateLimiter');

// Device authentication endpoints (no auth required - called by ESP32)
router.post('/rfid', accessLimiter, accessController.authenticateRFID);
router.post('/fingerprint', accessLimiter, accessController.authenticateFingerprint);

// Remote unlock (requires authentication)
router.post('/remote-unlock', verifyToken, accessController.remoteUnlock);

// Get door status
router.get('/status/:device_id', verifyToken, accessController.getDoorStatus);

module.exports = router;
