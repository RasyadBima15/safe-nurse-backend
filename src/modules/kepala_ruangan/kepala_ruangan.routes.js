import { Router } from 'express';
import { getKepalaRuangan, registerKepalaRuangan, updateKepalaRuangan } from './kepala_ruangan.controller.js';

const router = Router();

router.get('/', getKepalaRuangan);
router.post('/register', registerKepalaRuangan);
router.put('/update', updateKepalaRuangan);

export default router;