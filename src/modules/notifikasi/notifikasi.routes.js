import { Router } from 'express';
import { getNotifikasi, getNewNotifikasi } from './notifikasi.controller.js';

const router = Router();

router.get('/', getNotifikasi);
router.get('/new', getNewNotifikasi);

export default router;