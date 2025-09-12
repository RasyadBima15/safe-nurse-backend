import { Router } from 'express';
import { getUsers } from './user.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getUsers);

export default router;