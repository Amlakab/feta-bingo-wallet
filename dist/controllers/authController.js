"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeGameCode = exports.generateGameCode = exports.refreshToken = exports.changePassword = exports.getProfile = exports.loginWithOtp = exports.sendOtp = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const otpGenerator_1 = require("../utils/otpGenerator");
const helpers_1 = require("../utils/helpers");
// Store one-time codes (In production, use Redis instead of Map)
const oneTimeCodes = new Map();
const register = async (req, res) => {
    try {
        const { phone, password, tg_id, agent_id } = req.body;
        // Validate required fields
        if (!phone || !password || !tg_id) {
            return (0, helpers_1.errorResponse)(res, 'Phone, password, and Telegram ID are required', 400);
        }
        // Check if user already exists with phone number
        const existingUserByPhone = await User_1.default.findOne({ phone });
        if (existingUserByPhone) {
            return (0, helpers_1.errorResponse)(res, 'User already exists with this phone number', 400);
        }
        // Check if user already exists with Telegram ID
        const existingUserByTelegram = await User_1.default.findOne({ tg_id });
        if (existingUserByTelegram) {
            return (0, helpers_1.errorResponse)(res, 'User already exists with this Telegram ID', 400);
        }
        // Create user data object
        const userData = {
            phone,
            password,
            tg_id
        };
        // Only add agent_id if provided and valid
        if (agent_id) {
            // Optional: Verify that the agent exists
            const agent = await User_1.default.findById(agent_id);
            if (agent && (agent.role === 'agent' || agent.role === 'admin')) {
                userData.agent_id = agent_id;
            }
            // If agent doesn't exist or is not an agent/admin, you can choose to:
            // 1. Skip adding agent_id (current behavior)
            // 2. Return an error
            // 3. Use a default agent
        }
        // Create new user
        const user = new User_1.default(userData);
        await user.save();
        // Generate token
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        (0, helpers_1.successResponse)(res, {
            token,
            user: {
                _id: user._id,
                phone: user.phone,
                role: user.role,
                wallet: user.wallet,
                tg_id: user.tg_id,
                agent_id: user.agent_id
            }
        }, 'Registration successful', 201);
    }
    catch (error) {
        // Handle duplicate key errors for tg_id
        if (error.code === 11000) {
            if (error.keyPattern?.tg_id) {
                return (0, helpers_1.errorResponse)(res, 'Telegram ID is already registered', 400);
            }
        }
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { phone, password } = req.body;
        // Find user
        const user = await User_1.default.findOne({ phone });
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'Invalid credentials', 400);
        }
        // Check if user is active
        if (!user.isActive) {
            return (0, helpers_1.errorResponse)(res, 'Your account has been deactivated. Please contact support.', 403);
        }
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return (0, helpers_1.errorResponse)(res, 'Invalid credentials', 400);
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        (0, helpers_1.successResponse)(res, {
            token,
            user: {
                _id: user._id,
                phone: user.phone,
                role: user.role,
                wallet: user.wallet,
            }
        }, 'Login successful');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.login = login;
const sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        // Check if user exists
        const user = await User_1.default.findOne({ phone });
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Generate OTP
        const otp = (0, otpGenerator_1.generateOTP)();
        (0, otpGenerator_1.storeOTP)(phone, otp);
        // In a real application, you would send the OTP via SMS
        // For development, we'll return it in the response
        console.log(`OTP for ${phone}: ${otp}`);
        (0, helpers_1.successResponse)(res, { otp: process.env.NODE_ENV === 'development' ? otp : null }, 'OTP sent successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.sendOtp = sendOtp;
const loginWithOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        // Check if user exists
        const user = await User_1.default.findOne({ phone });
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Verify OTP
        if (!(0, otpGenerator_1.verifyOTP)(phone, otp)) {
            return (0, helpers_1.errorResponse)(res, 'Invalid or expired OTP', 400);
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        (0, helpers_1.successResponse)(res, {
            token,
            user: {
                _id: user._id,
                phone: user.phone,
                role: user.role,
                wallet: user.wallet,
            }
        }, 'Login successful');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.loginWithOtp = loginWithOtp;
const getProfile = async (req, res) => {
    try {
        (0, helpers_1.successResponse)(res, req.user, 'Profile retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getProfile = getProfile;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return (0, helpers_1.errorResponse)(res, 'Current password is incorrect', 400);
        }
        // Update password
        user.password = newPassword;
        await user.save();
        (0, helpers_1.successResponse)(res, null, 'Password updated successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.changePassword = changePassword;
// ==================== REFRESH TOKEN ====================
/**
 * Refresh an expired token
 * This endpoint takes an expired token and generates a new one
 */
const refreshToken = async (req, res) => {
    try {
        // Get the expired token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, helpers_1.errorResponse)(res, 'No token provided', 401);
        }
        const expiredToken = authHeader.split(' ')[1];
        try {
            // Try to verify the token (it should fail with TokenExpiredError)
            jsonwebtoken_1.default.verify(expiredToken, process.env.JWT_SECRET);
            // If it verifies, the token is not expired
            return (0, helpers_1.errorResponse)(res, 'Token is still valid, no refresh needed', 400);
        }
        catch (error) {
            // If error is not TokenExpiredError, token is invalid
            if (error.name !== 'TokenExpiredError') {
                return (0, helpers_1.errorResponse)(res, 'Invalid token', 401);
            }
        }
        // Decode the expired token to get user ID
        const decoded = jsonwebtoken_1.default.decode(expiredToken);
        if (!decoded || !decoded.id) {
            return (0, helpers_1.errorResponse)(res, 'Invalid token payload', 401);
        }
        // Find user in database
        const user = await User_1.default.findById(decoded.id);
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Check if user is active
        if (!user.isActive) {
            return (0, helpers_1.errorResponse)(res, 'Your account has been deactivated. Please contact support.', 403);
        }
        // Generate new token
        const newToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Return new token
        (0, helpers_1.successResponse)(res, {
            token: newToken,
            user: {
                _id: user._id,
                phone: user.phone,
                role: user.role,
                wallet: user.wallet,
            }
        }, 'Token refreshed successfully');
    }
    catch (error) {
        console.error('Refresh token error:', error);
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.refreshToken = refreshToken;
// ==================== ONE-TIME CODE FOR TELEGRAM BOT ====================
/**
 * Generate a one-time code for Telegram bot web app authentication
 * This code can be exchanged for a JWT token
 */
const generateGameCode = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return (0, helpers_1.errorResponse)(res, 'User ID is required', 400);
        }
        // Check if user exists
        const user = await User_1.default.findById(userId);
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Generate a secure random code
        const crypto = require('crypto');
        const code = crypto.randomBytes(32).toString('hex');
        // Store with expiry (5 minutes)
        oneTimeCodes.set(code, {
            userId: userId,
            expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        });
        // Clean up expired codes (optional)
        cleanExpiredCodes();
        (0, helpers_1.successResponse)(res, { code }, 'Game code generated successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.generateGameCode = generateGameCode;
/**
 * Exchange a one-time code for a JWT token
 * This is called by the web app when user clicks the bot link
 */
const exchangeGameCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return (0, helpers_1.errorResponse)(res, 'Code is required', 400);
        }
        // Check if code exists and is valid
        const codeData = oneTimeCodes.get(code);
        if (!codeData) {
            return (0, helpers_1.errorResponse)(res, 'Invalid or expired code', 400);
        }
        // Check if code has expired
        if (codeData.expires < Date.now()) {
            oneTimeCodes.delete(code);
            return (0, helpers_1.errorResponse)(res, 'Code has expired', 400);
        }
        // Get user from database
        const user = await User_1.default.findById(codeData.userId);
        if (!user) {
            oneTimeCodes.delete(code);
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Delete used code (one-time use)
        oneTimeCodes.delete(code);
        // Return token and user data
        (0, helpers_1.successResponse)(res, {
            token,
            user: {
                _id: user._id,
                phone: user.phone,
                role: user.role,
                wallet: user.wallet,
            }
        }, 'Code exchanged successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.exchangeGameCode = exchangeGameCode;
/**
 * Clean up expired codes from memory
 * In production, use Redis with TTL instead
 */
function cleanExpiredCodes() {
    const now = Date.now();
    for (const [key, value] of oneTimeCodes.entries()) {
        if (value.expires < now) {
            oneTimeCodes.delete(key);
        }
    }
}
// Optional: Run cleanup every  5 minutes
setInterval(cleanExpiredCodes, 5 * 60 * 1000);
