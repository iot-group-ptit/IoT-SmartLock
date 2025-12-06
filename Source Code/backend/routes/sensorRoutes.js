const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');

// Get all sensors
router.get('/', verifyToken, sensorController.getAllSensors);

// Get sensor by ID
router.get('/:sensor_id', verifyToken, sensorController.getSensorById);

// Telemetry routes
router.get('/telemetry/data', verifyToken, sensorController.getTelemetryData);
router.post('/telemetry/data', sensorController.createTelemetry); // No auth for device posting

module.exports = router;
