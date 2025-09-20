import { Router } from 'express';
import { sendTokenThroughEmail, resetPassword, changePassword } from './forgot_password.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.post('/', sendTokenThroughEmail);
router.post('/reset_password', resetPassword);
router.post('/change_password', authenticateToken, authorizeRoles("super_admin", "perawat", "kepala_ruangan", "chief_nursing", "verifikator"), changePassword);

export default router;