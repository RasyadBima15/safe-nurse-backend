import { Router } from 'express';
import { cleanLaporanUsingLLM, generateLaporan, getLaporanByIdPerawat, getAllLaporan, getLaporanByIdRuangan } from './laporan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/generate', authenticateToken, authorizeRoles("perawat"), generateLaporan);
router.post('/clean', authenticateToken, authorizeRoles("perawat"), cleanLaporanUsingLLM);
router.get('/', authenticateToken, authorizeRoles("verifikator", "super_admin"), getAllLaporan);
router.get('/perawat', authenticateToken, authorizeRoles("perawat"), getLaporanByIdPerawat);
router.get('/ruangan', authenticateToken, authorizeRoles("kepala_ruangan", "ipcn"), getLaporanByIdRuangan);

export default router;