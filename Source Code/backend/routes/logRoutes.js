const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get all access logs (admin/manager)
router.get('/', isAdminOrManager, logController.getAccessLogs);

// Get access statistics (admin/manager)
router.get('/statistics', isAdminOrManager, logController.getAccessStatistics);

// Get user access history
router.get('/user/:user_id', logController.getUserAccessHistory);

// Export access logs (admin/manager)
router.get('/export', isAdminOrManager, logController.exportAccessLogs);

module.exports = router;
