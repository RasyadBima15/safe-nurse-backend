import { Router } from 'express';
import { sendTokenThroughEmail, resetPassword, changePassword } from './forgot_password.controller.js';

const router = Router();

router.post('/', sendTokenThroughEmail);
router.post('/reset_password', resetPassword);
router.post('/change_password', changePassword);

export default router;