import { Router } from 'express';
import { getRuangan, registerRuangan } from './ruangan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getRuangan);
router.post('/register-ruangan', authenticateToken, authorizeRoles("super_admin"), registerRuangan);

export default router;