const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register new user
const register = async (req, res, next) => {
  try {
    const { user_id, email, full_name, phone, role, org_id } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email or user_id already exists'
      });
    }

    // Create new user
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
      message: 'User registered successfully',
      data: {
        userId: user.user_id,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user (biometric authentication)
const login = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    // Find user
    const user = await User.findOne({ user_id });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          user_id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ user_id: req.user.userId })
      .select('-__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone, email } = req.body;
    const updateData = {};

    if (full_name) updateData.full_name = full_name;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const user = await User.findOneAndUpdate(
      { user_id: req.user.userId },
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
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Change password - Deprecated (new schema uses biometric-only authentication)
const changePassword = async (req, res, next) => {
  try {
    return res.status(501).json({
      success: false,
      message: 'Password authentication not supported in new schema. Use biometric authentication.'
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Get user
    const user = await User.findOne({ user_id: decoded.userId }).lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    const newToken = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.json({
      success: true,
      data: { token: newToken }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken
};
