const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyToken } = require('../middleware/auth');

// Public routes
router.post('/register', authLimiter, validateUserRegistration, authController.register);
router.post('/login', authLimiter, validateUserLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
