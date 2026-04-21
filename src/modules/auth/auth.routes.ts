import { Router } from 'express';
import { loginController, logoutController, getCurrentUserController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/login', loginController);
router.post('/logout', logoutController);
router.get('/me', authenticate, getCurrentUserController);

export default router;
