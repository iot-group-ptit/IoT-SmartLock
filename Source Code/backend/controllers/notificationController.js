const Notification = require('../models/Notification');

// Get all notifications for user
const getUserNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, is_read } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    const filter = { user_id: userId };
    if (is_read !== undefined) {
      filter.is_read = is_read === 'true' || is_read === '1';
    }

    const notifications = await Notification.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      user_id: userId,
      is_read: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { id, user_id: userId },
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { user_id: userId },
      { is_read: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      id,
      user_id: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Create notification (internal use)
const createNotification = async (userId, type, title, message) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    
    await Notification.create({
      id: uuidv4(),
      user_id: userId,
      notification_type: type,
      title,
      message
    });

    // Emit to Socket.IO if available
    if (global.io) {
      global.io.to(`user_${userId}`).emit('new_notification', {
        type,
        title,
        message,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification
};
