"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// Get wallet info
//router.get('/', authenticate, getWallet);
// Get transaction history
//router.get('/transactions', authenticate, getTransactions);
// Get winnings
//router.get('/winnings', authenticate, getWinnings);
// Deposit
//router.post('/deposit', paymentLimiter, authenticate, initializeDeposit);
// Verify deposit (after redirect from Chapa)
//router.get('/deposit/verify/:tx_ref', authenticate, verifyDeposit);
// Webhook (Chapa calls this)
//router.post('/webhook', handleWebhook);
// Withdraw funds
//router.post('/withdraw', paymentLimiter, authenticate, requestWithdrawal);
exports.default = router;
