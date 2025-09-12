import { Router } from 'express';
import { cleanLaporanUsingLLM, generateLaporan, getLaporanByIdPerawat, getAllLaporanForVerifikator, getLaporanByIdRuangan, getAllLaporanForAdmin } from './laporan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/generate', authenticateToken, authorizeRoles("perawat"), generateLaporan);
router.post('/clean', authenticateToken, authorizeRoles("perawat"), cleanLaporanUsingLLM);
router.get('/verifikator', authenticateToken, authorizeRoles("verifikator"), getAllLaporanForVerifikator);
router.get('/perawat', authenticateToken, authorizeRoles("perawat"), getLaporanByIdPerawat);
router.get('/ruangan', authenticateToken, authorizeRoles("kepala_ruangan", "ipcn"), getLaporanByIdRuangan);
router.get('/admin', authenticateToken, authorizeRoles("super_admin"), getAllLaporanForAdmin);

export default router;