const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(verifyToken);
router.use(isAdmin);

// Get all organizations
router.get('/', organizationController.getAllOrganizations);

// Get organization by ID
router.get('/:org_id', organizationController.getOrganizationById);

// Create organization
router.post('/', organizationController.createOrganization);

// Update organization
router.put('/:org_id', organizationController.updateOrganization);

// Delete organization
router.delete('/:org_id', organizationController.deleteOrganization);

module.exports = router;
