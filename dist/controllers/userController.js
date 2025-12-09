"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEarnings = exports.updateEarnings = exports.getUsersByAgentId = exports.minusWallet = exports.setWallet = exports.updateWallet = exports.changePassword = exports.getUser = exports.getUserStatistics = exports.deleteUser = exports.updateUserStatus = exports.createUser = exports.getAllUsers = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const GameHistory_1 = __importDefault(require("../models/GameHistory"));
const SpinnerHistory_1 = __importDefault(require("../models/SpinnerHistory"));
// Helper functions
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data
    });
};
const errorResponse = (res, message = 'Error', statusCode = 500) => {
    res.status(statusCode).json({
        success: false,
        message
    });
};
// Get all users with pagination and filtering
const getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';
        const skip = (page - 1) * limit;
        // Build filter object
        const filter = {};
        if (search) {
            filter.phone = { $regex: search, $options: 'i' };
        }
        if (role) {
            filter.role = role;
        }
        if (status) {
            filter.isActive = status === 'active';
        }
        const users = await User_1.default.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const totalUsers = await User_1.default.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);
        successResponse(res, {
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        }, 'Users retrieved successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.getAllUsers = getAllUsers;
// Create new user
const createUser = async (req, res) => {
    try {
        const { phone, password, role, wallet } = req.body;
        // Check if user already exists
        const existingUser = await User_1.default.findOne({ phone });
        if (existingUser) {
            return errorResponse(res, 'User with this phone number already exists', 400);
        }
        const newUser = new User_1.default({
            phone,
            password,
            role: role || 'user',
            wallet: wallet || 0,
            dailyEarnings: 0,
            weeklyEarnings: 0,
            totalEarnings: 0,
            tg_id: '@fetabingo1221',
            isActive: true
        });
        await newUser.save();
        // Return user without password
        const userResponse = await User_1.default.findById(newUser._id).select('-password');
        successResponse(res, userResponse, 'User created successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.createUser = createUser;
// Update user status (block/unblock)
const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return errorResponse(res, 'isActive must be a boolean value', 400);
        }
        const user = await User_1.default.findByIdAndUpdate(userId, { isActive }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        successResponse(res, user, `User ${isActive ? 'activated' : 'blocked'} successfully`);
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.updateUserStatus = updateUserStatus;
// Delete user with all related data
const deleteUser = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        const { userId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return errorResponse(res, 'Invalid user ID', 400);
        }
        console.log(`Starting deletion process for user: ${userId}`);
        // Find the user first to check their role
        const user = await User_1.default.findById(userId).session(session);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        session.startTransaction();
        // Delete all transactions related to the user
        const transactionResult = await Transaction_1.default.deleteMany({
            userId: user._id
        }).session(session);
        console.log(`Deleted ${transactionResult.deletedCount} transactions for user ${userId}`);
        let gameHistoryResult = null;
        let spinnerHistoryResult = null;
        // Delete game history based on user role
        if (user.role === 'user') {
            // Delete from GameHistory for regular users, disk-users, agents, admins
            gameHistoryResult = await GameHistory_1.default.deleteMany({
                winnerId: user._id
            }).session(session);
            console.log(`Deleted ${gameHistoryResult.deletedCount} game history records for user ${userId}`);
        }
        else {
            // Delete from SpinnerHistory for spinner users
            spinnerHistoryResult = await SpinnerHistory_1.default.deleteMany({
                winnerId: user._id
            }).session(session);
            console.log(`Deleted ${spinnerHistoryResult.deletedCount} spinner history records for user ${userId}`);
        }
        // Delete the user
        await User_1.default.findByIdAndDelete(user._id).session(session);
        console.log(`User ${userId} deleted successfully`);
        // Commit the transaction
        await session.commitTransaction();
        // Prepare response data
        const deletionSummary = {
            transactionsDeleted: transactionResult.deletedCount,
            gameHistoryDeleted: gameHistoryResult?.deletedCount || 0,
            spinnerHistoryDeleted: spinnerHistoryResult?.deletedCount || 0,
            userRole: user.role
        };
        successResponse(res, deletionSummary, 'User and all related data deleted successfully');
    }
    catch (error) {
        // If anything fails, abort the transaction
        await session.abortTransaction();
        console.error('Error deleting user and related data:', error);
        errorResponse(res, `Failed to delete user: ${error.message}`, 500);
    }
    finally {
        session.endSession();
    }
};
exports.deleteUser = deleteUser;
// Get user statistics
const getUserStatistics = async (req, res) => {
    try {
        const totalUsers = await User_1.default.countDocuments();
        const activeUsers = await User_1.default.countDocuments({ isActive: true });
        const blockedUsers = await User_1.default.countDocuments({ isActive: false });
        const userRoles = await User_1.default.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);
        const totalWalletBalance = await User_1.default.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$wallet' }
                }
            }
        ]);
        const totalEarnings = await User_1.default.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalEarnings' }
                }
            }
        ]);
        successResponse(res, {
            totalUsers,
            activeUsers,
            blockedUsers,
            roles: userRoles,
            totalWalletBalance: totalWalletBalance[0]?.total || 0,
            totalEarnings: totalEarnings[0]?.total || 0
        }, 'Statistics retrieved successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.getUserStatistics = getUserStatistics;
// Get single user
const getUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User_1.default.findById(userId).select('-password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        successResponse(res, user, 'User retrieved successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.getUser = getUser;
// Change user password
const changePassword = async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        // Find user
        const user = await User_1.default.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return errorResponse(res, 'Current password is incorrect', 400);
        }
        // Update password
        user.password = newPassword;
        await user.save();
        successResponse(res, null, 'Password changed successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.changePassword = changePassword;
// Update wallet
const updateWallet = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        // Check if the user has sufficient balance if amount is negative
        if (amount < 0 && user.wallet < Math.abs(amount)) {
            return errorResponse(res, 'Insufficient wallet balance', 400);
        }
        user.wallet += amount;
        await user.save();
        successResponse(res, { wallet: user.wallet }, 'Wallet updated successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.updateWallet = updateWallet;
// Set user wallet to a specific value
const setWallet = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (typeof amount !== 'number' || amount < 0) {
            return errorResponse(res, 'Amount must be a non-negative number', 400);
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        user.wallet = amount;
        await user.save();
        successResponse(res, { wallet: user.wallet }, 'Wallet updated successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.setWallet = setWallet;
const minusWallet = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        // Get current date and reset daily/weekly earnings if needed
        const now = new Date();
        const lastUpdated = new Date(user.updatedAt);
        // Reset daily earnings if it's a new day
        if (lastUpdated.getDate() !== now.getDate()) {
            user.dailyEarnings = 0;
        }
        // Reset weekly earnings if it's a new week
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const lastUpdateStartOfWeek = new Date(lastUpdated);
        lastUpdateStartOfWeek.setDate(lastUpdated.getDate() - lastUpdated.getDay());
        if (startOfWeek.getTime() !== lastUpdateStartOfWeek.getTime()) {
            user.weeklyEarnings = 0;
        }
        // Update earnings
        user.dailyEarnings += amount;
        user.weeklyEarnings += amount;
        user.totalEarnings += amount;
        user.wallet -= amount;
        await user.save();
        successResponse(res, {
            wallet: user.wallet,
            dailyEarnings: user.dailyEarnings,
            weeklyEarnings: user.weeklyEarnings,
            totalEarnings: user.totalEarnings
        }, 'Earnings updated successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.minusWallet = minusWallet;
// Fetch users by agent ID
const getUsersByAgentId = async (req, res) => {
    try {
        const { agentId } = req.params;
        // Validate ObjectId format
        if (!mongoose_1.default.Types.ObjectId.isValid(agentId)) {
            return errorResponse(res, 'Invalid agent ID', 400);
        }
        // Find all users that belong to the given agent
        const users = await User_1.default.find({ agent_id: agentId })
            .select('-password')
            .sort({ createdAt: -1 });
        if (!users.length) {
            return successResponse(res, [], 'No users found for this agent', 200);
        }
        successResponse(res, users, 'Users retrieved successfully for the agent');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.getUsersByAgentId = getUsersByAgentId;
// Update earnings
const updateEarnings = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        // Get current date and reset daily/weekly earnings if needed
        const now = new Date();
        const lastUpdated = new Date(user.updatedAt);
        // Reset daily earnings if it's a new day
        if (lastUpdated.getDate() !== now.getDate()) {
            user.dailyEarnings = 0;
        }
        // Reset weekly earnings if it's a new week
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const lastUpdateStartOfWeek = new Date(lastUpdated);
        lastUpdateStartOfWeek.setDate(lastUpdated.getDate() - lastUpdated.getDay());
        if (startOfWeek.getTime() !== lastUpdateStartOfWeek.getTime()) {
            user.weeklyEarnings = 0;
        }
        // Update earnings
        // user.dailyEarnings += amount;
        // user.weeklyEarnings += amount;
        // user.totalEarnings += amount;
        user.wallet += amount;
        await user.save();
        successResponse(res, {
            wallet: user.wallet,
            // dailyEarnings: user.dailyEarnings,
            // weeklyEarnings: user.weeklyEarnings,
            // totalEarnings: user.totalEarnings
        }, 'Earnings updated successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.updateEarnings = updateEarnings;
// sync earnings
const syncEarnings = async (req, res) => {
    try {
        const { phone, remainingWallets, dailyEarning, weeklyEarning, totalEarning } = req.body;
        const user = await User_1.default.findOne({ phone });
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }
        // Get current date and reset daily/weekly earnings if needed
        const now = new Date();
        const lastUpdated = new Date(user.updatedAt);
        // Reset daily earnings if it's a new day
        if (lastUpdated.getDate() !== now.getDate()) {
            user.dailyEarnings = 0;
        }
        // Reset weekly earnings if it's a new week
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const lastUpdateStartOfWeek = new Date(lastUpdated);
        lastUpdateStartOfWeek.setDate(lastUpdated.getDate() - lastUpdated.getDay());
        if (startOfWeek.getTime() !== lastUpdateStartOfWeek.getTime()) {
            user.weeklyEarnings = 0;
        }
        //Update earnings
        user.remainingWallet = remainingWallets;
        user.dailyEarnings = dailyEarning;
        user.weeklyEarnings = weeklyEarning;
        user.totalEarnings = totalEarning;
        // user.wallet += amount;
        await user.save();
        successResponse(res, {
            // wallet: user.wallet,
            remainingWallet: user.remainingWallet,
            dailyEarnings: user.dailyEarnings,
            weeklyEarnings: user.weeklyEarnings,
            totalEarnings: user.totalEarnings
        }, 'Earnings updated successfully');
    }
    catch (error) {
        errorResponse(res, error.message, 500);
    }
};
exports.syncEarnings = syncEarnings;
