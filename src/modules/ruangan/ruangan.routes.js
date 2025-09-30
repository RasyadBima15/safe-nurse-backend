import { Router } from 'express';
import { getRuangan, registerRuangan, updateRuangan, deleteRuangan } from './ruangan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getRuangan);
router.post('/register-ruangan', authenticateToken, authorizeRoles("super_admin"), registerRuangan);
router.put('/update/:id_ruangan', authenticateToken, authorizeRoles("super_admin"), updateRuangan);
router.delete('/delete/:id_ruangan', authenticateToken, authorizeRoles("super_admin"), deleteRuangan);

export default router;