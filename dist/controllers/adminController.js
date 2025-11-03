"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = exports.updateTransaction = exports.getTransactions = exports.updateGame = exports.createGame = exports.getGame = exports.getGames = exports.updateUser = exports.getUser = exports.getUsers = void 0;
const User_1 = __importDefault(require("../models/User"));
const Game_1 = __importDefault(require("../models/Game"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const helpers_1 = require("../utils/helpers");
const getUsers = async (req, res) => {
    try {
        const { role, isActive, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (isActive !== undefined)
            filter.isActive = isActive === 'true';
        const users = await User_1.default.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        const total = await User_1.default.countDocuments(filter);
        (0, helpers_1.successResponse)(res, {
            users,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        }, 'Users retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getUsers = getUsers;
const getUser = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select('-password');
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        (0, helpers_1.successResponse)(res, user, 'User retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getUser = getUser;
const updateUser = async (req, res) => {
    try {
        const { role, isActive, wallet } = req.body;
        const user = await User_1.default.findById(req.params.id);
        if (!user) {
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        }
        if (role)
            user.role = role;
        if (isActive !== undefined)
            user.isActive = isActive;
        if (wallet !== undefined)
            user.wallet = wallet;
        await user.save();
        (0, helpers_1.successResponse)(res, user, 'User updated successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.updateUser = updateUser;
const getGames = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        const games = await Game_1.default.find(filter)
            .populate('winner', 'phone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        const total = await Game_1.default.countDocuments(filter);
        (0, helpers_1.successResponse)(res, {
            games,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        }, 'Games retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getGames = getGames;
const getGame = async (req, res) => {
    try {
        const game = await Game_1.default.findById(req.params.id)
            .populate('winner', 'phone');
        if (!game) {
            return (0, helpers_1.errorResponse)(res, 'Game not found', 404);
        }
        (0, helpers_1.successResponse)(res, game, 'Game retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getGame = getGame;
const createGame = async (req, res) => {
    try {
        const { name, cardCount, cardPrice, startTime } = req.body;
        const game = new Game_1.default({
            name,
            cardCount,
            cardPrice,
            startTime: new Date(startTime),
        });
        await game.save();
        (0, helpers_1.successResponse)(res, game, 'Game created successfully', 201);
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.createGame = createGame;
const updateGame = async (req, res) => {
    try {
        const { status, winner } = req.body;
        const game = await Game_1.default.findById(req.params.id);
        if (!game) {
            return (0, helpers_1.errorResponse)(res, 'Game not found', 404);
        }
        if (status)
            game.status = status;
        if (winner)
            game.winner = winner;
        if (status === 'completed' && !game.endTime) {
            game.endTime = new Date();
        }
        await game.save();
        (0, helpers_1.successResponse)(res, game, 'Game updated successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.updateGame = updateGame;
const getTransactions = async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (type)
            filter.type = type;
        if (status)
            filter.status = status;
        const transactions = await Transaction_1.default.find(filter)
            .populate('userId', 'phone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        const total = await Transaction_1.default.countDocuments(filter);
        (0, helpers_1.successResponse)(res, {
            transactions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        }, 'Transactions retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getTransactions = getTransactions;
const updateTransaction = async (req, res) => {
    try {
        const { status } = req.body;
        const transaction = await Transaction_1.default.findById(req.params.id);
        if (!transaction) {
            return (0, helpers_1.errorResponse)(res, 'Transaction not found', 404);
        }
        if (status)
            transaction.status = status;
        // If withdrawal is rejected, return funds to user
        if (transaction.type === 'withdrawal' && status === 'failed' && transaction.status === 'pending') {
            const user = await User_1.default.findById(transaction.userId);
            if (user) {
                user.wallet += transaction.amount;
                await user.save();
            }
        }
        await transaction.save();
        (0, helpers_1.successResponse)(res, transaction, 'Transaction updated successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.updateTransaction = updateTransaction;
const getAnalytics = async (req, res) => {
    try {
        // Get total users count
        const totalUsers = await User_1.default.countDocuments();
        const activeUsers = await User_1.default.countDocuments({ isActive: true });
        // Get total games count
        const totalGames = await Game_1.default.countDocuments();
        const activeGames = await Game_1.default.countDocuments({ status: 'active' });
        // Get revenue data
        const revenueData = await Transaction_1.default.aggregate([
            {
                $match: {
                    type: 'game_purchase',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' }
                }
            }
        ]);
        const totalRevenue = revenueData[0]?.totalRevenue || 0;
        // Get payout data
        const payoutData = await Transaction_1.default.aggregate([
            {
                $match: {
                    type: 'winning',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    totalPayouts: { $sum: '$amount' }
                }
            }
        ]);
        const totalPayouts = payoutData[0]?.totalPayouts || 0;
        // Get recent transactions
        const recentTransactions = await Transaction_1.default.find()
            .populate('userId', 'phone')
            .sort({ createdAt: -1 })
            .limit(10);
        (0, helpers_1.successResponse)(res, {
            users: {
                total: totalUsers,
                active: activeUsers
            },
            games: {
                total: totalGames,
                active: activeGames
            },
            financials: {
                revenue: totalRevenue,
                payouts: totalPayouts,
                profit: totalRevenue - totalPayouts
            },
            recentTransactions
        }, 'Analytics retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getAnalytics = getAnalytics;
