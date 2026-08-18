import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { generateOTP, storeOTP, verifyOTP } from '../utils/otpGenerator';
import { successResponse, errorResponse } from '../utils/helpers';

// Store one-time codes (In production, use Redis instead of Map)
const oneTimeCodes = new Map<string, { userId: string; expires: number }>();

export const register = async (req: Request, res: Response) => {
  try {
    const { phone, password, tg_id, agent_id } = req.body;

    // Validate required fields
    if (!phone || !password || !tg_id) {
      return errorResponse(res, 'Phone, password, and Telegram ID are required', 400);
    }

    // Check if user already exists with phone number
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      return errorResponse(res, 'User already exists with this phone number', 400);
    }

    // Check if user already exists with Telegram ID
    const existingUserByTelegram = await User.findOne({ tg_id });
    if (existingUserByTelegram) {
      return errorResponse(res, 'User already exists with this Telegram ID', 400);
    }

    // Create user data object
    const userData: any = {
      phone,
      password,
      tg_id
    };

    // Only add agent_id if provided and valid
    // if (agent_id) {
    //   // Optional: Verify that the agent exists
    //   const agent = await User.findById(agent_id);
    //   if (agent && (agent.role === 'agent' || agent.role === 'admin' || agent.role === 'user')) {
    //     userData.agent_id = agent_id;
    //   }
    //   // If agent doesn't exist or is not an agent/admin, you can choose to:
    //   // 1. Skip adding agent_id (current behavior)
    //   // 2. Return an error
    //   // 3. Use a default agent
    // }

     // Handle referral/agent logic
      if (agent_id) {
        // ✅ Find the referrer by ID
        const agent = await User.findById(agent_id);
        
        if (agent) {
          // ✅ If agent is 'agent' or 'admin' → Set as agent_id (no bonus)
          if (agent.role === 'agent' || agent.role === 'admin') {
            userData.agent_id = agent_id;
          } 
          // ✅ If agent is 'user' → Add 20 birr bonus to their wallet
          else if (agent.role === 'user') {
            // agent is already the user found by agent_id
            agent.wallet = (agent.wallet || 0) + 20;
            await agent.save();
            console.log(`🎁 Referral bonus: User ${agent_id} received 20 ETB from new user ${phone}`);
          }
        }
      }

    // Create new user
    const user = new User(userData);
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    successResponse(res, {
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
  } catch (error: any) {
    // Handle duplicate key errors for tg_id
    if (error.code === 11000) {
      if (error.keyPattern?.tg_id) {
        return errorResponse(res, 'Telegram ID is already registered', 400);
      }
    }
    errorResponse(res, error.message, 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return errorResponse(res, 'Invalid credentials', 400);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'Your account has been deactivated. Please contact support.', 403);
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials', 400);
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    successResponse(res, {
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
      }
    }, 'Login successful');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Generate OTP
    const otp = generateOTP();
    storeOTP(phone, otp);

    // In a real application, you would send the OTP via SMS
    // For development, we'll return it in the response
    console.log(`OTP for ${phone}: ${otp}`);

    successResponse(res, { otp: process.env.NODE_ENV === 'development' ? otp : null }, 'OTP sent successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const loginWithOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Verify OTP
    if (!verifyOTP(phone, otp)) {
      return errorResponse(res, 'Invalid or expired OTP', 400);
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    successResponse(res, {
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
      }
    }, 'Login successful');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    successResponse(res, req.user, 'Profile retrieved successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    successResponse(res, null, 'Password updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const checkUserByTelegramId = async (req: Request, res: Response) => {
  try {
    const { tg_id } = req.params;
    
    if (!tg_id) {
      return errorResponse(res, 'Telegram ID is required', 400);
    }

    const cleanTgId = tg_id.replace('@', '').trim();
    const user = await User.findOne({ tg_id: cleanTgId });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    successResponse(res, {
      _id: user._id,
      phone: user.phone,
      role: user.role,
      wallet: user.wallet,
      isActive: user.isActive,
      tg_id: user.tg_id
    }, 'User found');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};


/**
 * ONE API TO RULE THEM ALL:
 * - Checks if user exists
 * - Validates token
 * - Auto-refreshes token if expired
 * - Returns appropriate status
 */
export const checkUserAndToken = async (req: Request, res: Response) => {
  try {
    const { tg_id } = req.params;
    
    if (!tg_id) {
      return errorResponse(res, 'Telegram ID is required', 400);
    }

    const cleanTgId = tg_id.replace('@', '').trim();
    
    // ✅ STEP 1: Check if user exists in database
    const user = await User.findOne({ tg_id: cleanTgId });
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // ✅ Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'User account is deactivated. Please contact support.', 403);
    }

    const authHeader = req.headers.authorization;
    
    // ✅ STEP 2: Check if token is provided
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // ✅ Token MISSING - Generate new token
      const newToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      return successResponse(res, {
        user: {
          _id: user._id,
          phone: user.phone,
          role: user.role,
          wallet: user.wallet,
          isActive: user.isActive,
          tg_id: user.tg_id,
        },
        token_status: 'refreshed',  // ✅ Indicates new token was generated
        token: newToken               // ✅ Include the new token
      }, 'Token generated successfully');
    }

    const token = authHeader.split(' ')[1];
    
    // ✅ STEP 3: Verify the token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      
      // Token is valid
      return successResponse(res, {
        user: {
          _id: user._id,
          phone: user.phone,
          role: user.role,
          wallet: user.wallet,
          isActive: user.isActive,
          tg_id: user.tg_id,
        },
        token_status: 'valid',
        token: token
      }, 'User found and token valid');
      
    } catch (error: any) {
      // ✅ STEP 4: Token INVALID or EXPIRED - Generate new token
      const newToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      return successResponse(res, {
        user: {
          _id: user._id,
          phone: user.phone,
          role: user.role,
          wallet: user.wallet,
          isActive: user.isActive,
          tg_id: user.tg_id,
        },
        token_status: 'refreshed',  // ✅ Indicates new token was generated
        token: newToken               // ✅ Include the new token
      }, 'Token refreshed successfully');
    }
    
  } catch (error: any) {
    console.error('Check user and token error:', error);
    errorResponse(res, error.message, 500);
  }
};


// ==================== REFRESH TOKEN ====================

/**
 * Refresh an expired token
 * This endpoint takes an expired token and generates a new one
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    // Get the expired token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }

    const expiredToken = authHeader.split(' ')[1];
    
    try {
      // Try to verify the token (it should fail with TokenExpiredError)
      jwt.verify(expiredToken, process.env.JWT_SECRET!);
      // If it verifies, the token is not expired
      return errorResponse(res, 'Token is still valid, no refresh needed', 400);
    } catch (error: any) {
      // If error is not TokenExpiredError, token is invalid
      if (error.name !== 'TokenExpiredError') {
        return errorResponse(res, 'Invalid token', 401);
      }
    }

    // Decode the expired token to get user ID
    const decoded = jwt.decode(expiredToken) as { id: string };
    if (!decoded || !decoded.id) {
      return errorResponse(res, 'Invalid token payload', 401);
    }

    // Find user in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'Your account has been deactivated. Please contact support.', 403);
    }

    // Generate new token
    const newToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Return new token
    successResponse(res, {
      token: newToken,
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
      }
    }, 'Token refreshed successfully');
  } catch (error: any) {
    console.error('Refresh token error:', error);
    errorResponse(res, error.message, 500);
  }
};


// ==================== ONE-TIME CODE FOR TELEGRAM BOT ====================

/**
 * Generate a one-time code for Telegram bot web app authentication
 * This code can be exchanged for a JWT token
 */
export const generateGameCode = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return errorResponse(res, 'User ID is required', 400);
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
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

    successResponse(res, { code }, 'Game code generated successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

/**
 * Exchange a one-time code for a JWT token
 * This is called by the web app when user clicks the bot link
 */
export const exchangeGameCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return errorResponse(res, 'Code is required', 400);
    }

    // Check if code exists and is valid
    const codeData = oneTimeCodes.get(code);
    if (!codeData) {
      return errorResponse(res, 'Invalid or expired code', 400);
    }
    
    // Check if code has expired
    if (codeData.expires < Date.now()) {
      oneTimeCodes.delete(code);
      return errorResponse(res, 'Code has expired', 400);
    }
    
    // Get user from database
    const user = await User.findById(codeData.userId);
    if (!user) {
      oneTimeCodes.delete(code);
      return errorResponse(res, 'User not found', 404);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '7d' }
    );
    
    // Delete used code (one-time use)
    oneTimeCodes.delete(code);
    
    // Return token and user data
    successResponse(res, {
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
      }
    }, 'Code exchanged successfully');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

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