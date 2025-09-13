import { Router } from 'express';
import { getAdmin, updateAdmin } from './admin.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getAdmin);
router.put('/update/:id_user', authenticateToken, authorizeRoles("super_admin"), updateAdmin);

export default router;