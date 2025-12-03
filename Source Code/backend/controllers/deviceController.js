const Device = require('../models/Device');
const Sensor = require('../models/Sensor');
const Telemetry = require('../models/Telemetry');
const FirmwareUpdate = require('../models/FirmwareUpdate');
const AccessLog = require('../models/AccessLog');

// Get all devices
const getAllDevices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, org_id } = req.query;
    const offset = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (org_id) filter.org_id = org_id;

    const devices = await Device.find(filter)
      .sort({ device_id: 1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await Device.countDocuments(filter);

    res.json({
      success: true,
      data: {
        devices,
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

// Get device by ID
const getDeviceById = async (req, res, next) => {
  try {
    const { device_id } = req.params;

    const device = await Device.findOne({ device_id }).lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Get sensors
    const sensors = await Sensor.find({ device_id }).lean();

    // Get latest telemetry
    const telemetry = await Telemetry.find({ device_id })
      .sort({ ts_utc: -1 })
      .limit(10)
      .lean();

    // Get firmware info
    const firmware = await FirmwareUpdate.findOne({ device_id })
      .sort({ start_ts: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        device,
        sensors,
        telemetry,
        firmware
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create device
const createDevice = async (req, res, next) => {
  try {
    const { device_id, type, model, status, fw_current, org_id } = req.body;

    const existing = await Device.findOne({ device_id });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Device ID already exists'
      });
    }

    await Device.create({
      device_id,
      type,
      model,
      status: status || 'offline',
      fw_current,
      org_id
    });

    res.status(201).json({
      success: true,
      message: 'Device created successfully',
      data: { device_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update device
const updateDevice = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const { type, model, status, fw_current, org_id } = req.body;

    const updateData = {};
    if (type) updateData.type = type;
    if (model) updateData.model = model;
    if (status) updateData.status = status;
    if (fw_current) updateData.fw_current = fw_current;
    if (org_id !== undefined) updateData.org_id = org_id;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const device = await Device.findOneAndUpdate(
      { device_id },
      updateData,
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete device
const deleteDevice = async (req, res, next) => {
  try {
    const { device_id } = req.params;

    const device = await Device.findOneAndDelete({ device_id });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get device statistics
const getDeviceStatistics = async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const { start_date, end_date } = req.query;

    // Get access logs count
    const filter = { device_id };
    if (start_date) filter.time = { $gte: new Date(start_date) };
    if (end_date) filter.time = { ...filter.time, $lte: new Date(end_date) };

    const accessStats = await AccessLog.aggregate([
      { $match: filter },
      { $group: { _id: '$result', count: { $sum: 1 } } },
      { $project: { result: '$_id', count: 1, _id: 0 } }
    ]);

    // Get sensor data count
    const sensorCount = await Sensor.countDocuments({ device_id });

    // Get telemetry count
    const telemetryCount = await Telemetry.countDocuments({ device_id });

    res.json({
      success: true,
      data: {
        accessStats,
        sensorCount,
        telemetryCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceStatistics
};
