import { Router } from 'express';
import { getChiefNursing, updateChiefNursing, getChiefNursingById} from './chief_nursing.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getChiefNursing);
router.get('/:id_chief_nursing', authenticateToken, authorizeRoles("chief_nursing"), getChiefNursingById);
router.put('/update', authenticateToken, authorizeRoles("chief_nursing"), updateChiefNursing);

export default router;