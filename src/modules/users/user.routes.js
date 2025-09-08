import { Router } from 'express';
import { getUsers } from './user.controller.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/role.js';

const router = Router();

router.get('/', authenticate, authorize(['admin']), getUsers);

export default router;