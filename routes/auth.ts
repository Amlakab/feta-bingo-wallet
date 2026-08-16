import express from 'express';
import {
  register,
  login,
  sendOtp,
  loginWithOtp,
  getProfile,
  changePassword,
  generateGameCode,
  exchangeGameCode,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRegistration, validateLogin } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimit';

const router = express.Router();

router.post('/register', authLimiter, validateRegistration, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/send-otp', authLimiter, sendOtp);
router.post('/login-otp', authLimiter, loginWithOtp);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);

// ==================== TELEGRAM BOT AUTH ROUTES ====================
// Generate one-time code for bot (requires authentication)
router.post('/generate-game-code', authenticate, generateGameCode);

// Exchange code for token (public -  but code is one-time and expires)
router.post('/exchange-game-code', authLimiter, exchangeGameCode);



export default router;