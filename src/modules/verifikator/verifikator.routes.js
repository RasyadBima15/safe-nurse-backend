import { Router } from 'express';
import { getVerifikator, updateVerifikator, getVerifikatorById } from './verifikator.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getVerifikator);
router.get('/:id_verifikator', authenticateToken, authorizeRoles("verifikator"), getVerifikatorById);
router.put('/update', authenticateToken, authorizeRoles("verifikator"), updateVerifikator);

export default router;