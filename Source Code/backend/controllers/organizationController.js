const Organization = require('../models/Organization');
const User = require('../models/User');
const Device = require('../models/Device');

// Get all organizations
const getAllOrganizations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const organizations = await Organization.find()
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await Organization.countDocuments();

    res.json({
      success: true,
      data: {
        organizations,
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

// Get organization by ID
const getOrganizationById = async (req, res, next) => {
  try {
    const { org_id } = req.params;

    const organization = await Organization.findOne({ org_id }).lean();

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get users count
    const userCount = await User.countDocuments({ org_id });

    // Get devices count
    const deviceCount = await Device.countDocuments({ org_id });

    res.json({
      success: true,
      data: {
        organization,
        stats: {
          users: userCount,
          devices: deviceCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create organization
const createOrganization = async (req, res, next) => {
  try {
    const { org_id, name, address } = req.body;

    // Check if org_id exists
    const existing = await Organization.findOne({ org_id });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Organization ID already exists'
      });
    }

    await Organization.create({
      org_id,
      name,
      address
    });

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: { org_id }
    });
  } catch (error) {
    next(error);
  }
};

// Update organization
const updateOrganization = async (req, res, next) => {
  try {
    const { org_id } = req.params;
    const { name, address } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const organization = await Organization.findOneAndUpdate(
      { org_id },
      updateData,
      { new: true }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.json({
      success: true,
      message: 'Organization updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete organization
const deleteOrganization = async (req, res, next) => {
  try {
    const { org_id } = req.params;

    const organization = await Organization.findOneAndDelete({ org_id });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization
};
