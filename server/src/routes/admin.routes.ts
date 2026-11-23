import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import {
  requireRole,
  requireOriginalSuperAdmin,
  requireWritePermission,
  requirePermission,
} from '../middleware/role.middleware';
import {
  getUsersController,
  getUserByIdController,
  createUserController,
  updateUserController,
  deleteUserController,
  updateUserStatusController,
  updateUserRoleController,
  resetUserPasswordController,
  getAuditLogsController,
  getHospitalsController,
  createHospitalController,
  updateHospitalController,
  deleteHospitalController,
  dispatchAdminNotificationController,
  getAdminClinicalOverviewController,
} from '../controllers/admin.controller';
import {
  getAdminSettings,
  updateSettings,
  publishDraftSettings,
  resetSettingsToDefault,
  getRbacMatrix,
  updateRbacMatrix,
  createRoleAnnouncement,
  updateRoleAnnouncement,
  deleteRoleAnnouncement,
  toggleRoleAnnouncement,
  updateRoleWidgets,
  resetRoleWidgets,
} from '../controllers/settings.controller';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// 1. List users with pagination and filters (ADMIN & SUPER_ADMIN)
router.get(
  '/users',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  getUsersController
);

// 2. Create new user with profile in MySQL (ADMIN & SUPER_ADMIN - Write required)
router.post(
  '/users',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  requireWritePermission,
  createUserController
);

// 3. Get single user details with role profile (ADMIN & SUPER_ADMIN)
router.get(
  '/users/:id',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  getUserByIdController
);

// 4. Update user details & profile in MySQL (ADMIN & SUPER_ADMIN - Write required)
router.put(
  '/users/:id',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  requireWritePermission,
  updateUserController
);

// 5. Delete user from MySQL (ADMIN & SUPER_ADMIN - Write required)
router.delete(
  '/users/:id',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  requireWritePermission,
  deleteUserController
);

// 6. Activate or deactivate user (ADMIN & SUPER_ADMIN - Write required)
router.patch(
  '/users/:id/status',
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  requirePermission('Manage User Accounts'),
  requireWritePermission,
  updateUserStatusController
);

// 7. Update user role (ROOT ORIGINAL SUPER_ADMIN ONLY - Strict Root Check)
router.patch(
  '/users/:id/role',
  requireOriginalSuperAdmin,
  requirePermission('Manage Administrator Roles'),
  requireWritePermission,
  updateUserRoleController
);

// 8. Shared System Settings & Configuration (ADMIN & SUPER_ADMIN)
router.get('/settings', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Configure Security & Firewalls'), getAdminSettings);
router.put('/settings', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Configure Security & Firewalls'), requireWritePermission, updateSettings);
router.post('/settings/publish', requireOriginalSuperAdmin, requireWritePermission, publishDraftSettings);
router.post('/settings/reset', requireOriginalSuperAdmin, requireWritePermission, resetSettingsToDefault);
router.get('/roles-permissions/matrix', requireRole(Role.ADMIN, Role.SUPER_ADMIN), getRbacMatrix);
router.put('/roles-permissions/matrix', requireOriginalSuperAdmin, requireWritePermission, updateRbacMatrix);
router.post('/settings/dashboards/:role/announcements', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, createRoleAnnouncement);
router.put('/settings/dashboards/:role/announcements/:id', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, updateRoleAnnouncement);
router.delete('/settings/dashboards/:role/announcements/:id', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, deleteRoleAnnouncement);
router.patch('/settings/dashboards/:role/announcements/:id/toggle', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, toggleRoleAnnouncement);
router.put('/settings/dashboards/:role/widgets', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, updateRoleWidgets);
router.post('/settings/dashboards/:role/widgets/reset', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, resetRoleWidgets);

// 9. Reset User Password (ADMIN & SUPER_ADMIN - Write required)
router.post('/users/:id/reset-password', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Manage User Accounts'), requireWritePermission, resetUserPasswordController);

// 10. Audit Logs Stream (ADMIN & SUPER_ADMIN)
router.get('/audit-logs', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('View Audit & Activity Logs'), getAuditLogsController);

// 11. Hospital Management APIs (ADMIN & SUPER_ADMIN)
router.get('/hospitals', requireRole(Role.ADMIN, Role.SUPER_ADMIN), getHospitalsController);
router.post('/hospitals', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Manage User Accounts'), requireWritePermission, createHospitalController);
router.put('/hospitals/:id', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Manage User Accounts'), requireWritePermission, updateHospitalController);
router.delete('/hospitals/:id', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requirePermission('Manage User Accounts'), requireWritePermission, deleteHospitalController);

// 12. Admin Notification Dispatch & Live Clinical Overview
router.post('/notifications/dispatch', requireRole(Role.ADMIN, Role.SUPER_ADMIN), requireWritePermission, dispatchAdminNotificationController);
router.get('/clinical-overview', requireRole(Role.ADMIN, Role.SUPER_ADMIN), getAdminClinicalOverviewController);

export default router;
