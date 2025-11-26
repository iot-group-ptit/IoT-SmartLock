const AccessLog = require('../models/AccessLog');

// Get all access logs
const getAccessLogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      user_id, 
      access_method, 
      result,
      start_date,
      end_date,
      device_id
    } = req.query;

    const offset = (page - 1) * limit;
    const filter = {};

    if (user_id) filter.user_id = user_id;
    if (access_method) filter.access_method = access_method;
    if (result) filter.result = result;
    if (device_id) filter.device_id = device_id;
    if (start_date || end_date) {
      filter.time = {};
      if (start_date) filter.time.$gte = new Date(start_date);
      if (end_date) filter.time.$lte = new Date(end_date);
    }

    const logs = await AccessLog.find(filter)
      .populate('user_id', 'user_id full_name')
      .sort({ time: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await AccessLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        logs,
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

// Get access statistics
const getAccessStatistics = async (req, res, next) => {
  try {
    const { start_date, end_date, user_id } = req.query;

    const matchFilter = {};
    if (user_id) matchFilter.user_id = user_id;
    if (start_date || end_date) {
      matchFilter.time = {};
      if (start_date) matchFilter.time.$gte = new Date(start_date);
      if (end_date) matchFilter.time.$lte = new Date(end_date);
    }

    // Total accesses by method
    const byMethod = await AccessLog.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$access_method', count: { $sum: 1 } } },
      { $project: { access_method: '$_id', count: 1, _id: 0 } }
    ]);

    // Total accesses by result
    const byResult = await AccessLog.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$result', count: { $sum: 1 } } },
      { $project: { result: '$_id', count: 1, _id: 0 } }
    ]);

    // Daily access count
    const dailyAccess = await AccessLog.aggregate([
      { $match: matchFilter },
      { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
        count: { $sum: 1 }
      } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
      { $sort: { date: -1 } },
      { $limit: 30 }
    ]);

    // Top users
    const topUsers = await AccessLog.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$user_id', access_count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: 'user_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { user_id: '$user.user_id', full_name: '$user.full_name', access_count: 1, _id: 0 } },
      { $sort: { access_count: -1 } },
      { $limit: 10 }
    ]);

    // Recent failed attempts
    const failedFilter = { ...matchFilter, result: { $in: ['failed', 'denied'] } };
    const failedAttempts = await AccessLog.find(failedFilter)
      .populate('user_id', 'full_name')
      .sort({ time: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: {
        byMethod,
        byResult,
        dailyAccess,
        topUsers,
        failedAttempts
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user access history
const getUserAccessHistory = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const logs = await AccessLog.find({ user_id })
      .sort({ time: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await AccessLog.countDocuments({ user_id });

    res.json({
      success: true,
      data: {
        logs,
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

// Export access logs (for API integration)
const exportAccessLogs = async (req, res, next) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;

    const filter = {};
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) filter.createdAt.$gte = new Date(start_date);
      if (end_date) filter.createdAt.$lte = new Date(end_date);
    }

    const logs = await AccessLog.find(filter)
      .populate('user_id', 'user_id full_name')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csv = [
        ['ID', 'User', 'Method', 'Result', 'Device', 'Timestamp'].join(','),
        ...logs.map(log => [
          log._id,
          log.user_id?.full_name || 'Unknown',
          log.access_method,
          log.result,
          log.device_id || 'N/A',
          log.createdAt
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=access_logs.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccessLogs,
  getAccessStatistics,
  getUserAccessHistory,
  exportAccessLogs
};
