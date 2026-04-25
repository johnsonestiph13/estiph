/**
 * ESTIF HOME ULTIMATE - HOMES API ROUTES
 * Home management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const homeController = require('../../controllers/homeController');
const { authMiddleware, homeOwnerMiddleware, homeAdminMiddleware, homeMemberMiddleware } = require('../../middleware/auth');

// Validation rules
const validateHomeId = [
    param('id').isMongoId().withMessage('Invalid home ID')
];

const validateCreateHome = [
    body('name').notEmpty().withMessage('Home name is required').isLength({ min: 2, max: 100 }),
    body('address').optional(),
    body('city').optional(),
    body('country').optional(),
    body('settings').optional().isObject()
];

const validateUpdateHome = [
    body('name').optional().isLength({ min: 2, max: 100 }),
    body('address').optional(),
    body('city').optional(),
    body('country').optional(),
    body('settings').optional().isObject()
];

const validateMember = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').optional().isIn(['admin', 'member', 'guest'])
];

const validateMemberId = [
    param('memberId').isMongoId().withMessage('Invalid member ID')
];

// Routes
router.get('/', authMiddleware, homeController.getUserHomes);
router.post('/', authMiddleware, validateCreateHome, homeController.createHome);
router.get('/:id', authMiddleware, validateHomeId, homeMemberMiddleware, homeController.getHome);
router.put('/:id', authMiddleware, validateHomeId, homeAdminMiddleware, validateUpdateHome, homeController.updateHome);
router.delete('/:id', authMiddleware, validateHomeId, homeOwnerMiddleware, homeController.deleteHome);

// Member management
router.get('/:id/members', authMiddleware, validateHomeId, homeAdminMiddleware, homeController.getHomeMembers);
router.post('/:id/members', authMiddleware, validateHomeId, homeAdminMiddleware, validateMember, homeController.addMember);
router.put('/:id/members/:memberId', authMiddleware, validateHomeId, validateMemberId, homeOwnerMiddleware, homeController.updateMemberRole);
router.delete('/:id/members/:memberId', authMiddleware, validateHomeId, validateMemberId, homeAdminMiddleware, homeController.removeMember);

// Room management
router.get('/:id/rooms', authMiddleware, validateHomeId, homeMemberMiddleware, homeController.getHomeRooms);
router.post('/:id/rooms', authMiddleware, validateHomeId, homeAdminMiddleware, homeController.addRoom);
router.put('/:id/rooms/:roomId', authMiddleware, validateHomeId, homeAdminMiddleware, homeController.updateRoom);
router.delete('/:id/rooms/:roomId', authMiddleware, validateHomeId, homeAdminMiddleware, homeController.deleteRoom);

// Home settings
router.get('/:id/settings', authMiddleware, validateHomeId, homeMemberMiddleware, homeController.getHomeSettings);
router.put('/:id/settings', authMiddleware, validateHomeId, homeAdminMiddleware, homeController.updateHomeSettings);

// Home statistics
router.get('/:id/stats', authMiddleware, validateHomeId, homeMemberMiddleware, homeController.getHomeStats);
router.get('/:id/activity', authMiddleware, validateHomeId, homeMemberMiddleware, homeController.getHomeActivity);

// Transfer ownership
router.post('/:id/transfer', authMiddleware, validateHomeId, homeOwnerMiddleware, homeController.transferOwnership);

module.exports = router;