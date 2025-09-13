import { Router } from 'express';
import { getNotifikasi, getNewNotifikasi, createNotifikasi } from './notifikasi.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/:id_user', getNotifikasi);
router.get('/new/:id_user', getNewNotifikasi);
router.post('/create', authenticateToken, authorizeRoles('super_admin'), createNotifikasi);

export default router;