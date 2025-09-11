import { Router } from 'express';
import { getKepalaRuangan, updateKepalaRuangan } from './kepala_ruangan.controller.js';

const router = Router();

router.get('/', getKepalaRuangan);
router.put('/update', updateKepalaRuangan);

export default router;