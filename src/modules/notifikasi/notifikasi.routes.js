import { Router } from 'express';
import { getNotifikasi, getNewNotifikasi, createNotifikasi, deleteNotifikasiById, deleteAllNotifikasi } from './notifikasi.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), getNotifikasi );
router.get('/new', authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), getNewNotifikasi);
router.post('/create', authenticateToken, authorizeRoles('super_admin'), createNotifikasi);
router.delete("/delete/:id_notifikasi", authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), deleteNotifikasiById);
router.delete("/delete", authenticateToken, authorizeRoles('perawat', 'kepala_ruangan', 'chief_nursing', 'verifikator'), deleteAllNotifikasi);

export default router;