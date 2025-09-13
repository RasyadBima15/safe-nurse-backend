import { Router } from 'express';
import { getNotifikasi, getNewNotifikasi, createNotifikasi } from './notifikasi.controller.js';

const router = Router();

router.get('/', getNotifikasi);
router.get('/new', getNewNotifikasi);
router.post('/create', createNotifikasi);

export default router;