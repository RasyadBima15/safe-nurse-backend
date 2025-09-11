import { Router } from 'express';
import { cleanLaporanUsingLLM, generateLaporan } from './laporan.controller.js';

const router = Router();

router.post('/generate', generateLaporan);
router.post('/clean', cleanLaporanUsingLLM);

export default router;