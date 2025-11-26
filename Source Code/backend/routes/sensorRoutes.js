const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');

// Get all sensors
router.get('/', verifyToken, sensorController.getAllSensors);

// Get sensor by ID
router.get('/:sensor_id', verifyToken, sensorController.getSensorById);

// Create sensor (admin/manager only)
router.post('/', verifyToken, isAdminOrManager, sensorController.createSensor);

// Update sensor (admin/manager only)
router.put('/:sensor_id', verifyToken, isAdminOrManager, sensorController.updateSensor);

// Delete sensor (admin/manager only)
router.delete('/:sensor_id', verifyToken, isAdminOrManager, sensorController.deleteSensor);

// Telemetry routes
router.get('/telemetry/data', verifyToken, sensorController.getTelemetryData);
router.post('/telemetry/data', sensorController.createTelemetry); // No auth for device posting

module.exports = router;
