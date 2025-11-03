"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Games_1 = __importDefault(require("../models/Games"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// CREATE - Create a new game
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { betAmount } = req.body;
        // Validate bet amount
        if (!betAmount || betAmount < 1 || betAmount > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bet amount. Must be between 1 and 10000'
            });
        }
        const game = new Games_1.default({
            betAmount
        });
        await game.save();
        res.status(201).json({
            success: true,
            message: 'Game created successfully',
            data: game
        });
    }
    catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating game',
            error: error.message
        });
    }
});
// READ - Get all games
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const games = await Games_1.default.find()
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            message: 'Games retrieved successfully',
            data: games
        });
    }
    catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching games',
            error: error.message
        });
    }
});
// READ - Get games by bet amount
router.get('/bet/:betAmount', auth_1.authenticate, async (req, res) => {
    try {
        const { betAmount } = req.params;
        const games = await Games_1.default.find({ betAmount: parseInt(betAmount) })
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            message: 'Games retrieved successfully',
            data: games
        });
    }
    catch (error) {
        console.error('Error fetching games by bet amount:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching games',
            error: error.message
        });
    }
});
// READ - Get game by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const game = await Games_1.default.findById(req.params.id);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }
        res.json({
            success: true,
            message: 'Game retrieved successfully',
            data: game
        });
    }
    catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching game',
            error: error.message
        });
    }
});
// UPDATE - Update game by ID
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { betAmount } = req.body;
        // Validate bet amount if provided
        if (betAmount && (betAmount < 1 || betAmount > 10000)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bet amount. Must be between 1 and 10000'
            });
        }
        const game = await Games_1.default.findByIdAndUpdate(req.params.id, { betAmount }, { new: true, runValidators: true });
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }
        res.json({
            success: true,
            message: 'Game updated successfully',
            data: game
        });
    }
    catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating game',
            error: error.message
        });
    }
});
// UPDATE - Update games by bet amount
router.put('/bet/:betAmount', auth_1.authenticate, async (req, res) => {
    try {
        const { betAmount } = req.params;
        const { newBetAmount } = req.body;
        // Validate new bet amount
        if (!newBetAmount || newBetAmount < 1 || newBetAmount > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Invalid new bet amount. Must be between 1 and 10000'
            });
        }
        const result = await Games_1.default.updateMany({ betAmount: parseInt(betAmount) }, { betAmount: newBetAmount });
        res.json({
            success: true,
            message: 'Games updated successfully',
            data: {
                modifiedCount: result.modifiedCount
            }
        });
    }
    catch (error) {
        console.error('Error updating games by bet amount:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating games',
            error: error.message
        });
    }
});
// DELETE - Delete game by ID
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const game = await Games_1.default.findByIdAndDelete(req.params.id);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }
        res.json({
            success: true,
            message: 'Game deleted successfully',
            data: game
        });
    }
    catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting game',
            error: error.message
        });
    }
});
// DELETE - Delete games by bet amount
router.delete('/bet/:betAmount', auth_1.authenticate, async (req, res) => {
    try {
        const { betAmount } = req.params;
        const result = await Games_1.default.deleteMany({ betAmount: parseInt(betAmount) });
        res.json({
            success: true,
            message: 'Games deleted successfully',
            data: {
                deletedCount: result.deletedCount
            }
        });
    }
    catch (error) {
        console.error('Error deleting games by bet amount:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting games',
            error: error.message
        });
    }
});
// DELETE - Delete all games
router.delete('/', auth_1.authenticate, async (req, res) => {
    try {
        const result = await Games_1.default.deleteMany({});
        res.json({
            success: true,
            message: 'All games deleted successfully',
            data: {
                deletedCount: result.deletedCount
            }
        });
    }
    catch (error) {
        console.error('Error deleting all games:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting games',
            error: error.message
        });
    }
});
exports.default = router;
