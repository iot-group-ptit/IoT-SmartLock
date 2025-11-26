const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdminOrManager, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get all users (admin/manager)
router.get('/', isAdminOrManager, userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Create new user (admin/manager)
router.post('/', isAdminOrManager, userController.createUser);

// Update user (admin/manager)
router.put('/:id', isAdminOrManager, userController.updateUser);

// Delete user (admin only)
router.delete('/:id', isAdmin, userController.deleteUser);

// Toggle user status (admin/manager)
router.patch('/:id/status', isAdminOrManager, userController.toggleUserStatus);

module.exports = router;
