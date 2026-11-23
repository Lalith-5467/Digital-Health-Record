import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireWritePermission } from '../middleware/role.middleware';
import { uploadFileHandler } from '../controllers/upload.controller';

const router = Router();

// Secure file upload endpoint (authenticated users - write clearance required)
router.post('/', authenticate, requireWritePermission, uploadFileHandler);

export default router;
