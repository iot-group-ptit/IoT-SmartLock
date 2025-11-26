const Command = require('../models/Command');
const FirmwareUpdate = require('../models/FirmwareUpdate');
const Device = require('../models/Device');
const mqttClient = require('../config/mqtt');

// Get all commands
const getAllCommands = async (req, res, next) => {
  try {
    const { device_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const filter = {};
    if (device_id) filter.device_id = device_id;
    if (status) filter.status = status;

    const commands = await Command.find(filter)
      .sort({ sent_ts: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        commands,
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

// Get command by ID
const getCommandById = async (req, res, next) => {
  try {
    const { command_id } = req.params;

    const command = await Command.findOne({ command_id }).lean();

    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    res.json({
      success: true,
      data: command
    });
  } catch (error) {
    next(error);
  }
};

// Send command to device
const sendCommand = async (req, res, next) => {
  try {
    const { command_id, name, parameters, device_id } = req.body;

    // Check if device exists
    const device = await Device.findOne({ device_id });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const sent_ts = new Date();

    // Save command to database
    await Command.create({
      command_id,
      name,
      parameters: parameters || null,
      sent_ts,
      status: 'pending',
      device_id
    });

    // Send via MQTT
    const topic = `smartlock/${device_id}/command`;
    mqttClient.publish(topic, {
      command_id,
      name,
      parameters: parameters ? JSON.parse(parameters) : {},
      sent_ts: sent_ts.toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Command sent successfully',
      data: { command_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update command status
const updateCommandStatus = async (req, res, next) => {
  try {
    const { command_id } = req.params;
    const { status } = req.body;

    const command = await Command.findOneAndUpdate(
      { command_id },
      { status },
      { new: true }
    );

    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    res.json({
      success: true,
      message: 'Command status updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get firmware updates
const getFirmwareUpdates = async (req, res, next) => {
  try {
    const { device_id, status } = req.query;

    const filter = {};
    if (device_id) filter.device_id = device_id;
    if (status) filter.status = status;

    const updates = await FirmwareUpdate.find(filter)
      .sort({ start_ts: -1 })
      .lean();

    res.json({
      success: true,
      data: updates
    });
  } catch (error) {
    next(error);
  }
};

// Initiate firmware update
const initiateFirmwareUpdate = async (req, res, next) => {
  try {
    const { update_id, from_version, to_version, device_id } = req.body;

    const start_ts = new Date();

    await FirmwareUpdate.create({
      update_id,
      from_version,
      to_version,
      status: 'in_progress',
      start_ts,
      device_id
    });

    // Send OTA command via MQTT
    const topic = `smartlock/${device_id}/ota`;
    mqttClient.publish(topic, {
      update_id,
      from_version,
      to_version,
      start_ts: start_ts.toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Firmware update initiated',
      data: { update_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update firmware update status
const updateFirmwareStatus = async (req, res, next) => {
  try {
    const { update_id } = req.params;
    const { status, end_ts } = req.body;

    const updateData = { status };
    if (end_ts) updateData.end_ts = end_ts;

    const firmwareUpdate = await FirmwareUpdate.findOneAndUpdate(
      { update_id },
      updateData,
      { new: true }
    );

    if (!firmwareUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Firmware update not found'
      });
    }

    // Update device firmware version if completed
    if (status === 'completed') {
      await Device.findOneAndUpdate(
        { device_id: firmwareUpdate.device_id },
        { fw_current: firmwareUpdate.to_version }
      );
    }

    res.json({
      success: true,
      message: 'Firmware update status updated'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCommands,
  getCommandById,
  sendCommand,
  updateCommandStatus,
  getFirmwareUpdates,
  initiateFirmwareUpdate,
  updateFirmwareStatus
};
