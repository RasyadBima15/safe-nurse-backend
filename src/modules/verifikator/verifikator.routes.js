import { Router } from 'express';
import { getVerifikator, updateVerifikator } from './verifikator.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getVerifikator);
router.put('/update/:id_user', authenticateToken, authorizeRoles("verifikator"), updateVerifikator);

export default router;