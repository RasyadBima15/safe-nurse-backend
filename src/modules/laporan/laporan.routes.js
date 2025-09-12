import { Router } from 'express';
import { cleanLaporanUsingLLM, generateLaporan, getLaporanByIdPerawat, getAllLaporan, getLaporanByIdRuangan } from './laporan.controller.js';

const router = Router();

router.post('/generate', generateLaporan);
router.post('/clean', cleanLaporanUsingLLM);
router.get('/', getAllLaporan);
router.get('/perawat', getLaporanByIdPerawat);
router.get('/ruangan', getLaporanByIdRuangan);

export default router;