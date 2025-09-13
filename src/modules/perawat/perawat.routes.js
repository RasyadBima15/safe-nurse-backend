import { Router } from 'express';
import { getPerawat, updatePerawat } from './perawat.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getPerawat);
router.put('/update/:id_user', authenticateToken, authorizeRoles("perawat"), updatePerawat);

export default router;