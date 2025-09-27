import { Router } from 'express';
import { 
    cleanLaporanUsingLLM, 
    generateLaporan, 
    getLaporanForPerawat, 
    getAllLaporanForVerifikator, 
    getLaporanForKepalaRuangan, 
    getAllLaporanForAdmin, 
    getLaporanForChiefNursing, 
    getLaporanByIdLaporan, 
    rejectLaporan, 
    approveLaporan,
    validateChronology,
    sendWANotification,
    // tambahCatatan,
    getLaporanMasuk,
    revisiLaporan } from './laporan.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/sendWA', authenticateToken, authorizeRoles("perawat", "kepala_ruangan"), sendWANotification);
router.post('/generate', authenticateToken, authorizeRoles("perawat"), generateLaporan);
router.post('/clean', authenticateToken, authorizeRoles("perawat"), cleanLaporanUsingLLM);
router.post('/validateChronology', authenticateToken, authorizeRoles("perawat"), validateChronology);

router.get('/verifikator', authenticateToken, authorizeRoles("verifikator"), getAllLaporanForVerifikator);
router.get('/perawat', authenticateToken, authorizeRoles("perawat"), getLaporanForPerawat);
router.get('/kepala_ruangan', authenticateToken, authorizeRoles("kepala_ruangan"), getLaporanForKepalaRuangan);
router.get('/chief_nursing', authenticateToken, authorizeRoles("chief_nursing"), getLaporanForChiefNursing);
router.get('/admin', authenticateToken, authorizeRoles("super_admin"), getAllLaporanForAdmin);
router.get('/laporanMasuk', authenticateToken, authorizeRoles("kepala_ruangan", "chief_nursing", "verifikator"), getLaporanMasuk);
router.get('/:kode_laporan', authenticateToken, authorizeRoles("perawat", "kepala_ruangan", "chief_nursing", "verifikator"), getLaporanByIdLaporan);

router.post('/reject/:kode_laporan', authenticateToken, authorizeRoles("kepala_ruangan"), rejectLaporan);
// router.post('/addCatatan/:kode_laporan', authenticateToken, authorizeRoles("kepala_ruangan", "chief_nursing", "verifikator"), tambahCatatan);
router.post('/approve/:kode_laporan', authenticateToken, authorizeRoles("kepala_ruangan", "chief_nursing", "verifikator"), approveLaporan);
router.post('/revisi/:kode_laporan', authenticateToken, authorizeRoles("kepala_ruangan", "chief_nursing", "verifikator"), revisiLaporan);


export default router;
