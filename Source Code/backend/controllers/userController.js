const User = require('../models/User');
const RFIDCard = require('../models/RFIDCard');
const BiometricData = require('../models/BiometricData');

// Get all users (admin/manager only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, org_id } = req.query;
    const offset = (page - 1) * limit;

    const filter = {};
    if (role) filter.role = role;
    if (org_id) filter.org_id = org_id;

    const users = await User.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const user = await User.findOne({ user_id }).select('-__v').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's authentication methods
    const rfidCards = await RFIDCard.find({ user_id })
      .select('card_id uid issued_at expired_at')
      .lean();

    const biometricData = await BiometricData.find({ user_id })
      .select('bio_id biometric_type registered_at')
      .lean();

    res.json({
      success: true,
      data: {
        user,
        authMethods: {
          rfidCards,
          biometricData
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new user
const createUser = async (req, res, next) => {
  try {
    const { user_id, email, full_name, phone, role, org_id } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email or user_id already exists'
      });
    }

    const user = await User.create({
      user_id,
      email,
      full_name,
      phone,
      role: role || 'user',
      org_id
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { userId: user.user_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update user
const updateUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { full_name, email, phone, role } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const user = await User.findOneAndUpdate(
      { user_id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
const deleteUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    // Prevent self-deletion
    if (user_id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findOneAndDelete({ user_id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clean up related data
    await RFIDCard.deleteMany({ user_id });
    await BiometricData.deleteMany({ user_id });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user status
const toggleUserStatus = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { is_active } = req.body;

    const user = await User.findOneAndUpdate(
      { user_id },
      { is_active },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
};
