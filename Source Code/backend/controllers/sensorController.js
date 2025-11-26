const Sensor = require('../models/Sensor');
const Telemetry = require('../models/Telemetry');

// Get all sensors
const getAllSensors = async (req, res, next) => {
  try {
    const { device_id, kind } = req.query;

    const filter = {};
    if (device_id) filter.device_id = device_id;
    if (kind) filter.kind = kind;

    const sensors = await Sensor.find(filter).lean();

    res.json({
      success: true,
      data: sensors
    });
  } catch (error) {
    next(error);
  }
};

// Get sensor by ID
const getSensorById = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    const sensor = await Sensor.findOne({ sensor_id }).lean();

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    // Get latest telemetry data
    const telemetry = await Telemetry.find({ sensor_id })
      .sort({ ts_utc: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: {
        sensor,
        telemetry
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create sensor
const createSensor = async (req, res, next) => {
  try {
    const { sensor_id, kind, unit, status, device_id } = req.body;

    const existing = await Sensor.findOne({ sensor_id });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Sensor ID already exists'
      });
    }

    await Sensor.create({
      sensor_id,
      kind,
      unit,
      status: status || 'active',
      device_id
    });

    res.status(201).json({
      success: true,
      message: 'Sensor created successfully',
      data: { sensor_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update sensor
const updateSensor = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { kind, unit, status } = req.body;

    const updateData = {};
    if (kind) updateData.kind = kind;
    if (unit !== undefined) updateData.unit = unit;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const sensor = await Sensor.findOneAndUpdate(
      { sensor_id },
      updateData,
      { new: true }
    );

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    res.json({
      success: true,
      message: 'Sensor updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete sensor
const deleteSensor = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    const sensor = await Sensor.findOneAndDelete({ sensor_id });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor not found'
      });
    }

    res.json({
      success: true,
      message: 'Sensor deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get telemetry data
const getTelemetryData = async (req, res, next) => {
  try {
    const { sensor_id, device_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const filter = {};
    if (sensor_id) filter.sensor_id = sensor_id;
    if (device_id) filter.device_id = device_id;
    if (start_date || end_date) {
      filter.ts_utc = {};
      if (start_date) filter.ts_utc.$gte = new Date(start_date);
      if (end_date) filter.ts_utc.$lte = new Date(end_date);
    }

    const telemetry = await Telemetry.find(filter)
      .sort({ ts_utc: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        telemetry,
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

// Create telemetry data
const createTelemetry = async (req, res, next) => {
  try {
    const { telemetry_id, value, quality, sensor_id, device_id } = req.body;

    await Telemetry.create({
      telemetry_id,
      value,
      quality: quality || 'good',
      sensor_id,
      device_id
    });

    res.status(201).json({
      success: true,
      message: 'Telemetry data created successfully',
      data: { telemetry_id }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getTelemetryData,
  createTelemetry
};
