const express = require('express');
const router = express.Router();
const biometricController = require('../controllers/biometricController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');
const { validateRFIDCard, validateFingerprint } = require('../middleware/validation');

// All routes require authentication
router.use(verifyToken);

// RFID Card routes
router.get('/rfid/user/:user_id', biometricController.getUserRFIDCards);

// Fingerprint routes
router.post('/fingerprint', isAdminOrManager, biometricController.addFingerprint);
router.get('/fingerprint/user/:user_id', biometricController.getUserFingerprints);

module.exports = router;
