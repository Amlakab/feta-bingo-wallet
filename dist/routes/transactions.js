"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET all transactions with pagination and filtering
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const status = req.query.status;
        const reference = req.query.reference;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        const skip = (page - 1) * limit;
        // Build filter object
        const filter = {};
        if (type)
            filter.type = type;
        if (status)
            filter.status = status;
        if (reference)
            filter.reference = reference;
        if (search) {
            filter.$or = [
                { transactionId: { $regex: search, $options: 'i' } },
                { senderPhone: { $regex: search, $options: 'i' } },
                { senderName: { $regex: search, $options: 'i' } },
                { receiverPhone: { $regex: search, $options: 'i' } },
                { receiverName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }
        const transactions = await Transaction_1.default.find(filter)
            .populate('userId', 'phone name')
            .sort({ createdAt: -1, status: 1 }) // Pending first, then by date
            .skip(skip)
            .limit(limit);
        const total = await Transaction_1.default.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: transactions,
            pagination: {
                current: page,
                total: totalPages,
                count: transactions.length,
                totalRecords: total
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions',
            error: error.message
        });
    }
});
// GET transactions by user ID
router.get('/user/:userId', auth_1.authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const status = req.query.status;
        const skip = (page - 1) * limit;
        // Build filter object
        const filter = { userId };
        if (type)
            filter.type = type;
        if (status)
            filter.status = status;
        const transactions = await Transaction_1.default.find(filter)
            .populate('userId', 'phone name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Transaction_1.default.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: transactions,
            pagination: {
                current: page,
                total: totalPages,
                count: transactions.length,
                totalRecords: total
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user transactions',
            error: error.message
        });
    }
});
// GET transaction by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const transaction = await Transaction_1.default.findById(req.params.id)
            .populate('userId', 'phone name');
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        res.json({
            success: true,
            data: transaction
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction',
            error: error.message
        });
    }
});
// GET transaction statistics
router.get('/stats/overview', auth_1.authenticate, async (req, res) => {
    try {
        const { userId } = req.query;
        const filter = userId ? { userId } : {};
        const totalTransactions = await Transaction_1.default.countDocuments(filter);
        const totalDeposits = await Transaction_1.default.aggregate([
            { $match: { ...filter, type: 'deposit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWithdrawals = await Transaction_1.default.aggregate([
            { $match: { ...filter, type: 'withdrawal', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWinnings = await Transaction_1.default.aggregate([
            { $match: { ...filter, type: 'winning', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalGamePurchases = await Transaction_1.default.aggregate([
            { $match: { ...filter, type: 'game_purchase', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const pendingDeposits = await Transaction_1.default.countDocuments({
            ...filter,
            type: 'deposit',
            status: 'pending'
        });
        const pendingWithdrawals = await Transaction_1.default.countDocuments({
            ...filter,
            type: 'withdrawal',
            status: 'pending'
        });
        const recentTransactions = await Transaction_1.default.find(filter)
            .populate('userId', 'phone name')
            .sort({ createdAt: -1 })
            .limit(5);
        res.json({
            success: true,
            data: {
                totalTransactions,
                totalDeposits: totalDeposits[0]?.total || 0,
                totalWithdrawals: totalWithdrawals[0]?.total || 0,
                totalWinnings: totalWinnings[0]?.total || 0,
                totalGamePurchases: totalGamePurchases[0]?.total || 0,
                pendingDeposits,
                pendingWithdrawals,
                netBalance: (totalWinnings[0]?.total || 0) + (totalDeposits[0]?.total || 0) -
                    (totalWithdrawals[0]?.total || 0) - (totalGamePurchases[0]?.total || 0),
                recentTransactions
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction statistics',
            error: error.message
        });
    }
});
// CREATE new transaction (for both deposit and withdrawal)
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { userId, type, amount, reference, description, transactionId, senderPhone, senderName, receiverPhone, receiverName, method, metadata } = req.body;
        // Validate required fields
        if (!userId || !type || !amount || !reference) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, type, amount, reference'
            });
        }
        // Validate transaction type
        if (!['deposit', 'withdrawal', 'game_purchase', 'winning'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction type'
            });
        }
        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }
        // Fetch user for withdrawals
        if (type === 'withdrawal') {
            const user = await User_1.default.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            // Check total pending withdrawals
            const pendingWithdrawals = await Transaction_1.default.aggregate([
                { $match: { userId: user._id, type: 'withdrawal', status: 'pending' } },
                { $group: { _id: null, totalPending: { $sum: '$amount' } } }
            ]);
            const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].totalPending : 0;
            const totalRequested = totalPending + amount;
            if (totalRequested > user.wallet) {
                return res.status(400).json({
                    success: false,
                    message: `You already have ${totalPending} in pending withdrawals. Please wait until they are processed before requesting ${amount}.`
                });
            }
        }
        // Check for duplicate transactionId
        if (transactionId) {
            const existingTx = await Transaction_1.default.findOne({ transactionId });
            if (existingTx) {
                return res.status(400).json({
                    success: false,
                    message: `Transaction ID '${transactionId}' already exists`
                });
            }
        }
        // Create transaction with pending status
        const transaction = new Transaction_1.default({
            userId,
            type,
            amount,
            status: 'pending', // Both deposits and withdrawals start as pending
            reference,
            description: description || `${type} via ${reference}`,
            transactionId,
            senderPhone,
            senderName,
            receiverPhone,
            receiverName,
            method,
            metadata
        });
        const savedTransaction = await transaction.save();
        await savedTransaction.populate('userId', 'phone name');
        res.status(201).json({
            success: true,
            data: savedTransaction,
            message: 'Transaction created successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating transaction',
            error: error.message
        });
    }
});
// UPDATE deposit status and handle wallet update (admin only)
router.put('/deposit/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        const transaction = await Transaction_1.default.findById(id);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        // if (transaction.type !== 'deposit' || transaction.type !== 'game_purchase') {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'This is not a deposit transaction'
        //   });
        // }
        // Update transaction
        const updateData = { status };
        if (reason)
            updateData.reason = reason;
        const updatedTransaction = await Transaction_1.default.findByIdAndUpdate(id, updateData, { new: true }).populate('userId', 'phone name');
        // If status is completed, update user wallet by adding the amount
        if (status === 'completed') {
            const user = await User_1.default.findById(transaction.userId);
            if (user) {
                if (user.role === 'disk-user') {
                    user.wallet += 100000; // fixed bonus for disk-user
                }
                else {
                    user.wallet += transaction.amount; // normal flow
                }
                await user.save();
            }
        }
        res.json({
            success: true,
            data: updatedTransaction,
            message: 'Deposit transaction updated successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating deposit transaction',
            error: error.message
        });
    }
});
// UPDATE withdrawal status and handle wallet update (admin only)
router.put('/withdrawal/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, transactionId, reason } = req.body;
        const transaction = await Transaction_1.default.findById(id);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        if (transaction.type !== 'withdrawal') {
            return res.status(400).json({
                success: false,
                message: 'This is not a withdrawal transaction'
            });
        }
        // Check for duplicate transactionId if updating
        if (transactionId) {
            const existingTx = await Transaction_1.default.findOne({
                transactionId,
                _id: { $ne: id } // exclude current transaction
            });
            if (existingTx) {
                return res.status(400).json({
                    success: false,
                    message: `Transaction ID '${transactionId}' already exists`
                });
            }
        }
        // Update transaction
        const updateData = { status };
        if (transactionId)
            updateData.transactionId = transactionId;
        if (reason)
            updateData.reason = reason;
        const updatedTransaction = await Transaction_1.default.findByIdAndUpdate(id, updateData, { new: true }).populate('userId', 'phone name');
        // If status is completed, update user wallet by subtracting the amount
        if (status === 'completed') {
            const user = await User_1.default.findById(transaction.userId);
            if (user) {
                // Check if user still has sufficient balance
                if (user.wallet < transaction.amount) {
                    return res.status(400).json({
                        success: false,
                        message: 'User no longer has sufficient balance for this withdrawal'
                    });
                }
                user.wallet -= transaction.amount;
                await user.save();
            }
        }
        res.json({
            success: true,
            data: updatedTransaction,
            message: 'Withdrawal transaction updated successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating withdrawal transaction',
            error: error.message
        });
    }
});
exports.default = router;
