import { Router } from 'express';
import { login, register } from './auth.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', authenticateToken, authorizeRoles("super_admin"), register);

export default router;