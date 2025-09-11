import { Router } from 'express';
import { getPerawat, updatePerawat } from './perawat.controller.js';

const router = Router();

router.get('/', getPerawat);
router.put('/update', updatePerawat);

export default router;