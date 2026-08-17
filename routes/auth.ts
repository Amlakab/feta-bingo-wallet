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
  refreshToken,
  checkUserByTelegramId, // ✅ Add this import
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
router.post('/generate-game-code', authenticate, generateGameCode);
router.post('/exchange-game-code', authLimiter, exchangeGameCode);

// ✅ Add refresh token route (does NOT require authentication)
router.post('/refresh-token', refreshToken);

// ✅ Add this route (PUBLIC - no authentication required)
router.get('/check-user/:tg_id', checkUserByTelegramId);

export default router;