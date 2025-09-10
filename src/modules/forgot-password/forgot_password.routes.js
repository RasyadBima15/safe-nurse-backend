import { Router } from 'express';
import { sendTokenThroughEmail, resetPassword } from './forgot_password.controller.js';

const router = Router();

router.post('/', sendTokenThroughEmail);
router.post('/reset_password', resetPassword);

export default router;