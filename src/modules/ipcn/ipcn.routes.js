import { Router } from 'express';
import { getIpcn, updateIpcn} from './ipcn.controller.js';

const router = Router();

router.get('/', getIpcn);
router.put('/update', updateIpcn);


export default router;