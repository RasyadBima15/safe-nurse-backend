import { Router } from 'express';
import { getNotifikasi } from './notifikasi.controller.js';

const router = Router();

router.get('/', getNotifikasi);

export default router;