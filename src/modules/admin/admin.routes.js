import { Router } from 'express';
import { getAdmin, updateAdmin, getAdminById } from './admin.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getAdmin);
router.get('/profile', authenticateToken, authorizeRoles("super_admin"), getAdminById);
router.put('/update', authenticateToken, authorizeRoles("super_admin"), updateAdmin);

export default router;