import { Router } from 'express';
import { getUsers, updateUser, deleteUser } from './user.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles("super_admin"), getUsers);
router.put('/update/:id_user', authenticateToken, authorizeRoles("super_admin"), updateUser);
router.delete('/delete/:id_user', authenticateToken, authorizeRoles("super_admin"), deleteUser);

export default router;