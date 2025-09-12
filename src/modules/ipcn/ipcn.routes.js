import { Router } from 'express';
import { getIpcn, updateIpcn} from './ipcn.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getIpcn);
router.put('/update', authenticateToken, authorizeRoles("ipcn"), updateIpcn);

export default router;