import { Router } from 'express';
import { cleanLaporanUsingLLM, generateLaporan, getLaporanByIdPerawat, getAllLaporanForVerifikator, getLaporanByIdRuangan, getAllLaporanForAdmin, getLaporanForChiefNursing, getLaporanByIdLaporan } from './laporan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/generate', authenticateToken, authorizeRoles("perawat"), generateLaporan);
router.post('/clean', authenticateToken, authorizeRoles("perawat"), cleanLaporanUsingLLM);
router.get('/verifikator', authenticateToken, authorizeRoles("verifikator"), getAllLaporanForVerifikator);
router.get('/perawat/:id_perawat', authenticateToken, authorizeRoles("perawat"), getLaporanByIdPerawat);
router.get('/ruangan/:id_ruangan', authenticateToken, authorizeRoles("kepala_ruangan"), getLaporanByIdRuangan);
router.get('/chief_nursing', authenticateToken, authorizeRoles("chief_nursing"), getLaporanForChiefNursing);
router.get('/admin', authenticateToken, authorizeRoles("super_admin"), getAllLaporanForAdmin);
router.get('/:kode_laporan', authenticateToken, authorizeRoles("kepala_ruangan", "chief_nursing", "verifikator"), getLaporanByIdLaporan);

export default router;