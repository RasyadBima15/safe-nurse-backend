import { Router } from 'express';
import { getAdmin, registerAdmin, updateAdmin } from './admin.controller.js';

const router = Router();

router.get('/', getAdmin);
router.post('/register', registerAdmin);
router.put('/update', updateAdmin);

export default router;