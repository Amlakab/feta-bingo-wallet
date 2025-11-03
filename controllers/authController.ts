import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { generateOTP, storeOTP, verifyOTP } from '../utils/otpGenerator';
import { successResponse, errorResponse } from '../utils/helpers';

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
    if (agent_id) {
      // Optional: Verify that the agent exists
      const agent = await User.findById(agent_id);
      if (agent && (agent.role === 'agent' || agent.role === 'admin')) {
        userData.agent_id = agent_id;
      }
      // If agent doesn't exist or is not an agent/admin, you can choose to:
      // 1. Skip adding agent_id (current behavior)
      // 2. Return an error
      // 3. Use a default agent
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