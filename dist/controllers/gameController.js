"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameHistory = exports.purchaseCard = exports.getUserCards = exports.getGame = exports.getGames = void 0;
const Game_1 = __importDefault(require("../models/Game"));
const BingoCard_1 = __importDefault(require("../models/BingoCard"));
const User_1 = __importDefault(require("../models/User"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const gameLogic_1 = require("../utils/gameLogic");
const helpers_1 = require("../utils/helpers");
const getGames = async (req, res) => {
    try {
        const { status, cardCount } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (cardCount)
            filter.cardCount = parseInt(cardCount);
        const games = await Game_1.default.find(filter)
            .sort({ startTime: -1 })
            .populate('winner', 'phone');
        (0, helpers_1.successResponse)(res, games, 'Games retrieved successfully');
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
const getUserCards = async (req, res) => {
    try {
        const { id: gameId } = req.params;
        const userId = req.user._id;
        const cards = await BingoCard_1.default.find({ gameId, userId });
        (0, helpers_1.successResponse)(res, cards, 'User cards retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getUserCards = getUserCards;
const purchaseCard = async (req, res) => {
    try {
        const { id: gameId } = req.params;
        const userId = req.user._id;
        // Check if game exists and is in waiting status
        const game = await Game_1.default.findById(gameId);
        if (!game) {
            return (0, helpers_1.errorResponse)(res, 'Game not found', 404);
        }
        if (game.status !== 'waiting') {
            return (0, helpers_1.errorResponse)(res, 'Cannot purchase cards for ongoing or completed games', 400);
        }
        // Check if user has already purchased maximum cards (2 per game)
        const userCardCount = await BingoCard_1.default.countDocuments({ gameId, userId });
        if (userCardCount >= 2) {
            return (0, helpers_1.errorResponse)(res, 'Maximum 2 cards allowed per game', 400);
        }
        // Check user balance
        const user = await User_1.default.findById(userId);
        if (!user || user.wallet < game.cardPrice) {
            return (0, helpers_1.errorResponse)(res, 'Insufficient balance', 400);
        }
        // Generate bingo card
        const cardNumbers = (0, gameLogic_1.generateBingoCard)();
        // Create bingo card
        const bingoCard = new BingoCard_1.default({
            gameId,
            userId,
            numbers: cardNumbers,
        });
        await bingoCard.save();
        // Deduct amount from user wallet
        user.wallet -= game.cardPrice;
        await user.save();
        // Create transaction record
        const transaction = new Transaction_1.default({
            userId,
            type: 'game_purchase',
            amount: game.cardPrice,
            status: 'completed',
            reference: `CARD-${Date.now()}-${userId}`,
            description: `Purchase of bingo card for game ${game.name}`,
            metadata: {
                gameId,
                cardId: bingoCard._id,
            }
        });
        await transaction.save();
        (0, helpers_1.successResponse)(res, bingoCard, 'Card purchased successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.purchaseCard = purchaseCard;
const getGameHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const games = await Game_1.default.find({
            status: 'completed',
            startTime: { $lte: new Date() }
        })
            .sort({ startTime: -1 })
            .limit(20);
        (0, helpers_1.successResponse)(res, games, 'Game history retrieved successfully');
    }
    catch (error) {
        (0, helpers_1.errorResponse)(res, error.message, 500);
    }
};
exports.getGameHistory = getGameHistory;
