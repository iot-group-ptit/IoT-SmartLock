const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Command routes
router.get('/commands', commandController.getAllCommands);
router.get('/commands/:command_id', commandController.getCommandById);
router.post('/commands', isAdminOrManager, commandController.sendCommand);

// Firmware update routes
router.get('/firmware', commandController.getFirmwareUpdates);
router.post('/firmware', isAdminOrManager, commandController.initiateFirmwareUpdate);

module.exports = router;
