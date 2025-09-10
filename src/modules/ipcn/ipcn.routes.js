import { Router } from 'express';
import { getIpcn, registerIpcn, updateIpcn} from './ipcn.controller.js';

const router = Router();

router.get('/', getIpcn);
router.post('/register', registerIpcn);
router.put('/update', updateIpcn);


export default router;