import { Router } from 'express';
import { getKepalaRuangan, updateKepalaRuangan } from './kepala_ruangan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getKepalaRuangan);
router.put('/update', authenticateToken, authorizeRoles("kepala_ruangan"), updateKepalaRuangan);

export default router;