const express = require('express');
const router = express.Router();
const faceController = require('../controllers/faceController');
const { verifyToken, isAdminOrManager } = require('../middleware/auth');
const { accessLimiter } = require('../middleware/rateLimiter');

// Register face (admin/manager)
router.post('/register', verifyToken, isAdminOrManager, faceController.upload.single('image'), faceController.registerFace);

// Authenticate face (called by device or app)
router.post('/authenticate', accessLimiter, faceController.upload.single('image'), faceController.authenticateFace);

// Get user face data
router.get('/user/:user_id', verifyToken, faceController.getUserFaceData);

// Delete face data (admin/manager)
router.delete('/:id', verifyToken, isAdminOrManager, faceController.deleteFaceData);

module.exports = router;
