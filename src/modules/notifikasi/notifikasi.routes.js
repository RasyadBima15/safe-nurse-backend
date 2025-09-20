import { Router } from 'express';
import { getNotifikasi, getNewNotifikasi, createNotifikasi } from './notifikasi.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), getNotifikasi );
router.get('/new', authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), getNewNotifikasi);
router.post('/create', authenticateToken, authorizeRoles('super_admin'), createNotifikasi);

export default router;