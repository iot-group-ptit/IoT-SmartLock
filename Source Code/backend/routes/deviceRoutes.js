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

// Update device (admin/manager only)
router.put('/:device_id', isAdminOrManager, deviceController.updateDevice);

// Delete device (admin/manager only)
router.delete('/:device_id', isAdminOrManager, deviceController.deleteDevice);

// Get device statistics
router.get('/:device_id/statistics', deviceController.getDeviceStatistics);

module.exports = router;
