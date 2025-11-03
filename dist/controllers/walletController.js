"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWinnings = exports.requestWithdrawal = exports.handleWebhook = exports.verifyDeposit = exports.initializeDeposit = exports.getTransactions = exports.getWallet = void 0;
const User_1 = __importDefault(require("../models/User"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const chapa_1 = require("../config/chapa");
const helpers_1 = require("../utils/helpers");
/**
 * Get user wallet info
 */
const getWallet = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user._id).select('wallet dailyEarnings weeklyEarnings totalEarnings');
        if (!user)
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        (0, helpers_1.successResponse)(res, user, 'Wallet retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getWallet = getWallet;
/**
 * Get user transactions
 */
const getTransactions = async (req, res) => {
    try {
        const { type, limit = 20, page = 1 } = req.query;
        const filter = { userId: req.user._id };
        if (type)
            filter.type = type;
        const transactions = await Transaction_1.default.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        const total = await Transaction_1.default.countDocuments(filter);
        (0, helpers_1.successResponse)(res, {
            transactions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        }, 'Transactions retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getTransactions = getTransactions;
/**
 * Initialize deposit with Chapa
 */
const initializeDeposit = async (req, res) => {
    try {
        const { amount, currency = 'ETB', method = 'card' } = req.body;
        const userId = req.user._id;
        const user = await User_1.default.findById(userId);
        if (!user)
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        const tx_ref = (0, chapa_1.generateTxRef)(userId.toString(), 'deposit');
        // Base payment options
        let paymentOptions = {
            amount: amount.toString(),
            currency,
            email: `${user.phone}@bingo.com`,
            first_name: 'User',
            last_name: user.phone,
            tx_ref,
            callback_url: `${process.env.CLIENT_URL}/wallet?success=true`,
            return_url: `${process.env.CLIENT_URL}/wallet`,
            customization: {
                title: 'Bingo Platform Deposit',
                description: `Deposit of ${amount} ${currency}`,
            },
        };
        // Add phone_number and payment_type for mobile methods
        if (method === 'telebirr' || method === 'cbe') {
            paymentOptions.phone_number = user.phone;
            paymentOptions.payment_type = method;
        }
        const response = await chapa_1.chapa.initialize(paymentOptions);
        // Save pending transaction
        const transaction = new Transaction_1.default({
            userId,
            type: 'deposit',
            amount,
            status: 'pending',
            reference: tx_ref,
            description: `Deposit of ${amount} ${currency}`,
            metadata: { method }
        });
        await transaction.save();
        (0, helpers_1.successResponse)(res, { checkout_url: response?.data?.checkout_url || null }, 'Deposit initialized successfully');
    }
    catch (error) {
        console.error('Deposit error:', error);
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.initializeDeposit = initializeDeposit;
/**
 * Verify deposit after payment
 */
const verifyDeposit = async (req, res) => {
    try {
        const { tx_ref } = req.params;
        const response = await chapa_1.chapa.verify(tx_ref);
        if (response?.status === 'success') {
            const transaction = await Transaction_1.default.findOne({ reference: tx_ref });
            if (transaction && transaction.status === 'pending') {
                transaction.status = 'completed';
                await transaction.save();
                const user = await User_1.default.findById(transaction.userId);
                if (user) {
                    user.wallet += transaction.amount;
                    await user.save();
                }
            }
            (0, helpers_1.successResponse)(res, { status: 'success' }, 'Deposit verified successfully');
        }
        else {
            (0, helpers_1.errorResponse)(res, 'Deposit verification failed', 400);
        }
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.verifyDeposit = verifyDeposit;
/**
 * Handle Chapa webhook (automatic deposit verification)
 */
const handleWebhook = async (req, res) => {
    try {
        const { tx_ref, status } = req.body;
        if (status === 'success') {
            const transaction = await Transaction_1.default.findOne({ reference: tx_ref });
            if (transaction && transaction.status === 'pending') {
                transaction.status = 'completed';
                await transaction.save();
                const user = await User_1.default.findById(transaction.userId);
                if (user) {
                    user.wallet += transaction.amount;
                    await user.save();
                }
            }
        }
        res.status(200).send('Webhook received');
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Webhook processing failed');
    }
};
exports.handleWebhook = handleWebhook;
/**
 * Request withdrawal
 */
const requestWithdrawal = async (req, res) => {
    try {
        const { amount, accountNumber, bankName, method = 'bank' } = req.body;
        const userId = req.user._id;
        const user = await User_1.default.findById(userId);
        if (!user)
            return (0, helpers_1.errorResponse)(res, 'User not found', 404);
        if (user.wallet < amount)
            return (0, helpers_1.errorResponse)(res, 'Insufficient balance', 400);
        if (amount < 50)
            return (0, helpers_1.errorResponse)(res, 'Minimum withdrawal amount is 50 ETB', 400);
        const transaction = new Transaction_1.default({
            userId,
            type: 'withdrawal',
            amount,
            status: 'pending',
            reference: `WTH-${Date.now()}-${userId}`,
            description: `Withdrawal request to ${bankName || 'Mobile'} account ${accountNumber}`,
            metadata: { accountNumber, bankName, method }
        });
        await transaction.save();
        // Reserve funds
        user.wallet -= amount;
        await user.save();
        (0, helpers_1.successResponse)(res, transaction, 'Withdrawal request submitted successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.requestWithdrawal = requestWithdrawal;
/**
 * Get user winnings (completed transactions of type 'winning')
 */
const getWinnings = async (req, res) => {
    try {
        const userId = req.user._id;
        const winnings = await Transaction_1.default.find({
            userId,
            type: 'winning',
            status: 'completed',
        }).sort({ createdAt: -1 }).limit(20);
        (0, helpers_1.successResponse)(res, winnings, 'Winnings retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getWinnings = getWinnings;
