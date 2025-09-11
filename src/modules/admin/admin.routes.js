import { Router } from 'express';
import { getAdmin, updateAdmin } from './admin.controller.js';

const router = Router();

router.get('/', getAdmin);
router.put('/update', updateAdmin);

export default router;