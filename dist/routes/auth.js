"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
router.post('/register', rateLimit_1.authLimiter, validation_1.validateRegistration, authController_1.register);
router.post('/login', rateLimit_1.authLimiter, validation_1.validateLogin, authController_1.login);
router.post('/send-otp', rateLimit_1.authLimiter, authController_1.sendOtp);
router.post('/login-otp', rateLimit_1.authLimiter, authController_1.loginWithOtp);
router.get('/profile', auth_1.authenticate, authController_1.getProfile);
router.put('/change-password', auth_1.authenticate, authController_1.changePassword);
// ==================== TELEGRAM BOT AUTH ROUTES ====================
router.post('/generate-game-code', auth_1.authenticate, authController_1.generateGameCode);
router.post('/exchange-game-code', rateLimit_1.authLimiter, authController_1.exchangeGameCode);
// ✅ Add refresh token route (does NOT require authentication)
router.post('/refresh-token', authController_1.refreshToken);
// ✅ Add this route (PUBLIC - no authentication required)
router.get('/check-user/:tg_id', authController_1.checkUserByTelegramId);
// ✅ Single endpoint that checks user and token
router.get('/check-user-token/:tg_id', authController_1.checkUserAndToken);
exports.default = router;
