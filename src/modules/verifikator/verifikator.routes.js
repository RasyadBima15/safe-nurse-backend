import { Router } from 'express';
import { getVerifikator, updateVerifikator } from './verifikator.controller.js';

const router = Router();

router.get('/', getVerifikator);
router.put('/update', updateVerifikator);

export default router;