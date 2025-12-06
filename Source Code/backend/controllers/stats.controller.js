const Device = require("../models/device.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");
const Organization = require("../models/organization.model");

// [GET] http://localhost:3000/stats- Lấy thống kê cho user_manager
module.exports.getOverviewStats = async (req, res) => {
  try {
    const managerId = req.user.id;

    // 1. Tổng số thiết bị mà user_manager sở hữu
    const totalDevices = await Device.countDocuments({ user_id: managerId });

    // 2. Tổng số user con
    const totalChildren = await User.countDocuments({
      parent_id: managerId,
      role: "user",
    });

    // 3. Tổng số cảnh báo bảo mật
    const totalSecurityAlerts = await Notification.countDocuments({
      user_id: managerId,
      notification_type: "security_alert",
    });

    // 4. Tổng số thông báo chưa đọc
    const unreadNotifications = await Notification.countDocuments({
      user_id: managerId,
      is_read: false,
    });

    //5. Thống kê số cảnh báo theo ngày
    const days = parseInt(req.query.days) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyAlerts = await Notification.aggregate([
      {
        $match: {
          user_id: managerId,
          notification_type: "security_alert",
          created_at: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedDailyAlerts = dailyAlerts.map((i) => ({
      date: i._id,
      count: i.count,
    }));

    return res.json({
      code: 200,
      message: "Lấy thống kê thành công!",
      data: {
        totalDevices,
        totalChildren,
        totalSecurityAlerts,
        unreadNotifications,
        dailyAlerts: formattedDailyAlerts,
      },
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi khi lấy thống kê!",
      error: err.message,
    });
  }
};

//[GET] http://localhost:3000/stats/admin - Lấy thống kê cho admin
module.exports.getAdminStats = async (req, res) => {
  try {
    // 1. Tổng số tổ chức
    const totalOrganizations = await Organization.countDocuments();

    // 2. Lấy thống kê từng tổ chức
    const orgStats = await Organization.aggregate([
      {
        $lookup: {
          from: "devices",
          localField: "_id",
          foreignField: "org_id",
          as: "devices",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "org_id",
          as: "users",
        },
      },
      {
        $project: {
          org_id: "$_id",
          org_name: "$name",
          total_devices: { $size: "$devices" },
          total_user_manager: {
            $size: {
              $filter: {
                input: "$users",
                as: "u",
                cond: { $eq: ["$$u.role", "user_manager"] },
              },
            },
          },
        },
      },
    ]);

    // 3. Thêm thống kê số cảnh báo cho từng tổ chức
    for (let org of orgStats) {
      const deviceIds = await Device.find({ org_id: org.org_id }).distinct(
        "device_id"
      );

      org.total_alerts = await Notification.countDocuments({
        notification_type: "security_alert",
        "metadata.device_id": { $in: deviceIds },
      });
    }

    // 4. Thống kê top 5 tổ chức có nhiều cảnh báo nhất
    const topOrganizations = [...orgStats]
      .sort((a, b) => b.total_alerts - a.total_alerts)
      .slice(0, 5);

    // 5. Thống kê cảnh báo theo ngày (toàn hệ thống)
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyAlerts = await Notification.aggregate([
      {
        $match: {
          notification_type: "security_alert",
          created_at: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).then((results) =>
      results.map((i) => ({
        date: i._id,
        count: i.count,
      }))
    );

    // 6. Top 5 thiết bị có nhiều cảnh báo
    const topDevices = await Notification.aggregate([
      {
        $match: { notification_type: "security_alert" },
      },
      {
        $group: {
          _id: "$metadata.device_id",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      code: 200,
      message: "Thống kê admin thành công!",
      data: {
        totalOrganizations,
        organizations: orgStats,
        topOrganizations,
        dailyAlerts,
        topDevices,
      },
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi khi lấy thống kê admin!",
      error: err.message,
    });
  }
};
