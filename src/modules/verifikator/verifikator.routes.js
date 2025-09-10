import { Router } from 'express';
import { getVerifikator, registerVerifikator, updateVerifikator } from './verifikator.controller.js';

const router = Router();

router.get('/', getVerifikator);
router.post('/register', registerVerifikator);
router.put('/update', updateVerifikator);

export default router;