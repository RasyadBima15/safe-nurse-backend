import { Router } from 'express';
import { getPerawat, registerPerawat, updatePerawat } from './perawat.controller.js';

const router = Router();

router.get('/', getPerawat);
router.post('/register', registerPerawat);
router.put('/update', updatePerawat);

export default router;