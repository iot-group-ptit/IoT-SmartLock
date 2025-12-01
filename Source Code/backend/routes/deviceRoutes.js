const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get all devices
router.get('/', deviceController.getAllDevices);

// Get device by ID
router.get('/:device_id', deviceController.getDeviceById);

// Create device (admin/manager only)
router.post('/', isAdminOrManager, deviceController.createDevice);

module.exports = router;
