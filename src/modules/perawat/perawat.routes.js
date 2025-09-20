import { Router } from 'express';
import { getPerawat, updatePerawat, getPerawatbyIdPerawat } from './perawat.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getPerawat);
router.get('/:id_perawat', authenticateToken, authorizeRoles("perawat"), getPerawatbyIdPerawat);
router.put('/update', authenticateToken, authorizeRoles("perawat"), updatePerawat);

export default router;