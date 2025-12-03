const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdminOrManager, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get all users (admin/manager)
router.get('/', isAdminOrManager, userController.getAllUsers);

// Get user by ID
router.get('/:user_id', userController.getUserById);

// Create new user (admin/manager)
router.post('/', isAdminOrManager, userController.createUser);

// Delete user (admin only)
router.delete('/:user_id', isAdmin, userController.deleteUser);

module.exports = router;
