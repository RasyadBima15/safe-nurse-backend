import { Router } from 'express';
import { getRuangan, registerRuangan } from './ruangan.controller.js';

const router = Router();

router.get('/', getRuangan);
router.post('/register-ruangan', registerRuangan);

export default router;