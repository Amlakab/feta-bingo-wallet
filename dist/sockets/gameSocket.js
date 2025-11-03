"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = setupSocket;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const GameHistory_1 = __importDefault(require("../models/GameHistory"));
const GameSession_1 = __importDefault(require("../models/GameSession"));
const Games_1 = __importDefault(require("../models/Games"));
const activeGames = new Map();
const betTimers = new Map();
let globalTimerInterval = null;
// Initialize and start the global timer
function startGlobalTimer(io) {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
    }
    globalTimerInterval = setInterval(async () => {
        let hasChanges = false;
        for (const [betAmount, currentState] of betTimers.entries()) {
            const newState = { ...currentState };
            let stateChanged = false;
            // ALWAYS update player count and prize pool regardless of status
            await updateBetTimerStats(betAmount);
            // Check if there are playing sessions for this bet amount (this determines in-progress status)
            const playingSessions = await GameSession_1.default.find({
                betAmount,
                status: 'playing'
            });
            const hasPlayingGame = playingSessions.length > 0;
            if (hasPlayingGame) {
                // Game is in progress - set status to in-progress
                if (newState.status !== 'in-progress') {
                    newState.status = 'in-progress';
                    newState.timer = 0;
                    stateChanged = true;
                    console.log(`Timer ${betAmount}: → IN-PROGRESS (game playing)`);
                }
            }
            else if (newState.status === 'ready') {
                // Ready phase countdown
                if (newState.timer > 0) {
                    newState.timer -= 1;
                    stateChanged = true;
                }
                if (newState.timer <= 0) {
                    newState.status = 'active';
                    newState.timer = 45;
                    newState.createdAt = new Date();
                    stateChanged = true;
                    console.log(`Timer ${betAmount}: READY → ACTIVE (45s)`);
                }
            }
            else if (newState.status === 'active') {
                // Active phase countdown
                if (newState.timer > 0) {
                    newState.timer -= 1;
                    stateChanged = true;
                }
                if (newState.timer <= 0) {
                    // Check if we have active sessions to potentially start a game
                    const activeSessions = await GameSession_1.default.find({
                        betAmount,
                        status: { $in: ['active', 'ready'] }
                    });
                    if (activeSessions.length > 0) {
                        //   const deleteResult = await GameSession.deleteMany({
                        //   betAmount,
                        //   status: 'active'
                        // });
                        // Players are present but game hasn't started yet - restart active phase
                        newState.timer = 45;
                        newState.createdAt = new Date();
                        console.log(`Timer ${betAmount}: ACTIVE → ACTIVE (restart 45s - players waiting)`);
                    }
                    else {
                        // No players - go back to ready
                        newState.status = 'ready';
                        newState.timer = 5;
                        newState.createdAt = null;
                        console.log(`Timer ${betAmount}: ACTIVE → READY (no players)`);
                    }
                    stateChanged = true;
                }
            }
            else if (newState.status === 'in-progress' && !hasPlayingGame) {
                // Game ended - reset to ready
                newState.status = 'ready';
                newState.timer = 5;
                newState.createdAt = null;
                stateChanged = true;
                console.log(`Timer ${betAmount}: IN-PROGRESS → READY (game ended)`);
            }
            if (stateChanged) {
                betTimers.set(betAmount, newState);
                hasChanges = true;
            }
        }
        if (hasChanges) {
            broadcastTimerStates(io);
        }
    }, 1000);
    console.log('Global timer started successfully');
}
// CORRECTED: Enhanced function with immediate broadcast capability
async function updateBetTimerStats(betAmount, io) {
    try {
        // ALWAYS count from database - never use cached values
        const allSessions = await GameSession_1.default.find({
            betAmount,
            status: { $in: ['active', 'ready', 'playing'] }
        });
        const playerCount = allSessions.length;
        const prizePool = playerCount * betAmount * 0.8;
        // ALWAYS update the timer state with fresh data
        if (!betTimers.has(betAmount)) {
            betTimers.set(betAmount, {
                status: 'ready',
                timer: 5,
                playerCount: 0,
                prizePool: 0,
                createdAt: null
            });
        }
        const timerState = betTimers.get(betAmount);
        // Check if values actually changed to avoid unnecessary broadcasts
        const valuesChanged = timerState.playerCount !== playerCount ||
            timerState.prizePool !== prizePool;
        timerState.playerCount = playerCount;
        timerState.prizePool = prizePool;
        console.log(`✅ Updated stats for ${betAmount}: ${playerCount} players, prize: ${prizePool}`);
        // Broadcast changes immediately if values changed and IO instance provided
        if (valuesChanged && io) {
            console.log(`📢 Broadcasting immediate update for ${betAmount}`);
            broadcastTimerStates(io);
        }
        return valuesChanged;
    }
    catch (error) {
        console.error('❌ Error updating bet timer stats:', error);
        return false;
    }
}
// NEW: Centralized function for session cleanup with guaranteed stats update
async function cleanupSessionsAndUpdateStats(io, betAmount, filter = {}) {
    try {
        // Delete sessions based on filter
        const deleteResult = await GameSession_1.default.deleteMany(filter);
        console.log(`🧹 Cleaned up sessions for ${betAmount}:`, deleteResult.deletedCount, 'sessions removed');
        // FORCE stats update and broadcast
        await updateBetTimerStats(betAmount, io);
        return deleteResult.deletedCount;
    }
    catch (error) {
        console.error('Error in cleanupSessionsAndUpdateStats:', error);
        return 0;
    }
}
// Initialize timers for all bet amounts
async function initializeBetTimers(io) {
    try {
        // Read available bet amounts from database
        const games = await Games_1.default.find().select('betAmount');
        const betAmounts = games.map(game => game.betAmount);
        // Clear any existing timers
        betTimers.clear();
        // Initialize timer for each unique bet amount
        betAmounts.forEach((betAmount) => {
            betTimers.set(betAmount, {
                status: 'ready',
                timer: 5,
                playerCount: 0,
                prizePool: 0,
                createdAt: null
            });
            console.log(`Initialized timer for bet amount: ${betAmount}`);
        });
        console.log(`Initialized timers for ${betAmounts.length} bet amounts:`, betAmounts);
        startGlobalTimer(io);
        broadcastTimerStates(io);
    }
    catch (error) {
        console.error('Error initializing bet timers:', error);
    }
}
// Broadcast timer states to all clients
function broadcastTimerStates(io) {
    const timerStates = {};
    betTimers.forEach((state, betAmount) => {
        timerStates[betAmount] = {
            status: state.status,
            timer: state.timer,
            playerCount: state.playerCount,
            prizePool: state.prizePool,
            createdAt: state.createdAt
        };
    });
    console.log('Broadcasting timer states:', timerStates);
    io.emit('timer-states-update', timerStates);
}
// Set bet timer to in-progress when game starts
function setBetTimerInProgress(betAmount) {
    const timerState = betTimers.get(betAmount);
    if (timerState) {
        timerState.status = 'in-progress';
        timerState.timer = 0;
        console.log(`Timer ${betAmount} set to IN-PROGRESS (game started)`);
    }
}
// Reset bet timer when game ends
function resetBetTimer(betAmount) {
    const timerState = betTimers.get(betAmount);
    if (timerState) {
        timerState.status = 'ready';
        timerState.timer = 5;
        timerState.createdAt = null;
        console.log(`Timer ${betAmount} reset to READY (game ended)`);
    }
}
// Add timer for new bet amount dynamically
function ensureBetTimerExists(betAmount) {
    if (!betTimers.has(betAmount)) {
        betTimers.set(betAmount, {
            status: 'ready',
            timer: 5,
            playerCount: 0,
            prizePool: 0,
            createdAt: null
        });
        console.log(`Created new timer for bet amount: ${betAmount}`);
    }
}
// Your existing bingo game functions remain the same
function generateAllBingoNumbers() {
    const letters = ["B", "I", "N", "G", "O"];
    const ranges = [
        { min: 1, max: 15 }, { min: 16, max: 30 },
        { min: 31, max: 45 }, { min: 46, max: 60 },
        { min: 61, max: 75 }
    ];
    const all = [];
    letters.forEach((l, i) => {
        for (let n = ranges[i].min; n <= ranges[i].max; n++) {
            all.push(`${l}-${n}`);
        }
    });
    return all;
}
function shuffleNumbers(numbers) {
    const a = [...numbers];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function startGameCalling(io, betAmount) {
    // Set timer to in-progress when game starts
    setBetTimerInProgress(betAmount);
    broadcastTimerStates(io);
    // Clear any existing interval for this bet amount
    if (activeGames.has(betAmount)) {
        const existingGame = activeGames.get(betAmount);
        if (existingGame.callingInterval) {
            clearInterval(existingGame.callingInterval);
        }
        if (existingGame.gracePeriodTimer) {
            clearTimeout(existingGame.gracePeriodTimer);
        }
    }
    const all = generateAllBingoNumbers();
    const shuffled = shuffleNumbers(all);
    const gameState = {
        betAmount,
        calledNumbers: [],
        remainingNumbers: shuffled,
        isCalling: true,
        isGameEnded: false,
        pendingWinners: [],
        gracePeriodActive: false
    };
    activeGames.set(betAmount, gameState);
    gameState.callingInterval = setInterval(async () => {
        const game = activeGames.get(betAmount);
        if (!game || game.remainingNumbers.length === 0 || game.isGameEnded) {
            stopGameCalling(betAmount);
            if (game && game.remainingNumbers.length === 0 && game.pendingWinners.length === 0) {
                console.log(`All 75 numbers called with no winner for betAmount: ${betAmount}. Cleaning up sessions.`);
                await handleNoWinnerGame(io, betAmount);
            }
            return;
        }
        const nextNumber = game.remainingNumbers[0];
        game.calledNumbers.push(nextNumber);
        game.remainingNumbers = game.remainingNumbers.slice(1);
        io.emit('number-called', {
            betAmount,
            number: nextNumber,
            calledNumbers: game.calledNumbers
        });
        if (game.remainingNumbers.length === 0) {
            stopGameCalling(betAmount);
            if (game.pendingWinners.length === 0) {
                console.log(`All 75 numbers called with no winner for betAmount: ${betAmount}. Cleaning up sessions.`);
                await handleNoWinnerGame(io, betAmount);
            }
        }
    }, 5000);
}
async function handleNoWinnerGame(io, betAmount) {
    const gameState = activeGames.get(betAmount);
    if (!gameState)
        return;
    endGameCompletely(io, betAmount);
    try {
        // Use centralized cleanup function instead of direct deletion
        await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount });
        console.log(`Deleted all sessions for betAmount: ${betAmount} (no winner)`);
        io.emit('game-ended', {
            winners: [],
            prizePool: 0,
            split: 0,
            totalWinners: 0,
            betAmount: betAmount,
            message: 'Game ended - all numbers called with no winner'
        });
        io.emit('sessions-updated', []);
        activeGames.delete(betAmount);
        console.log(`Game state cleared for betAmount: ${betAmount} (no winner)`);
    }
    catch (error) {
        console.error('Error handling no-winner game:', error);
        io.emit('error', { message: 'Failed to clean up no-winner game' });
    }
}
function stopGameCalling(betAmount) {
    const g = activeGames.get(betAmount);
    if (g) {
        if (g.callingInterval) {
            clearInterval(g.callingInterval);
            g.callingInterval = undefined;
        }
        g.isCalling = false;
    }
}
function endGameCompletely(io, betAmount) {
    const g = activeGames.get(betAmount);
    if (g) {
        g.isGameEnded = true;
        g.gracePeriodActive = false;
        if (g.gracePeriodTimer) {
            clearTimeout(g.gracePeriodTimer);
            g.gracePeriodTimer = undefined;
        }
        resetBetTimer(betAmount);
        // Update stats after game ends
        updateBetTimerStats(betAmount, io); // Added io parameter
    }
}
function getGameState(betAmount) {
    return activeGames.get(betAmount);
}
async function handleWinnerSubmission(io, betAmount, winnerId, winnerCard, prizePool) {
    const gameState = activeGames.get(betAmount);
    if (!gameState) {
        console.log(`No active game found for betAmount: ${betAmount}`);
        return;
    }
    const isDuplicate = gameState.pendingWinners.some(w => w.userId === winnerId && w.card === winnerCard);
    if (isDuplicate) {
        console.log(`Duplicate winner submission rejected: ${winnerId}, card ${winnerCard}`);
        return;
    }
    if (gameState.isCalling) {
        console.log(`First winner found! Stopping number calling for betAmount: ${betAmount}`);
        stopGameCalling(betAmount);
        gameState.gracePeriodActive = true;
        io.emit('game-stopped', {
            betAmount,
            firstWinner: { userId: winnerId, card: winnerCard },
            message: `Player ${winnerCard} wins! 4-second grace period started.`,
            allWinners: gameState.pendingWinners
        });
        if (!gameState.gracePeriodTimer) {
            console.log(`Starting 4-second grace period timer for betAmount: ${betAmount}`);
            gameState.gracePeriodTimer = setTimeout(async () => {
                console.log(`Grace period ended for betAmount: ${betAmount}, finalizing game...`);
                await finalizeGame(io, betAmount, prizePool);
            }, 4000);
        }
    }
    gameState.pendingWinners.push({ userId: winnerId, card: winnerCard });
    console.log(`Winner added: ${winnerId}, card ${winnerCard}. Total winners: ${gameState.pendingWinners.length}`);
    io.emit('winner-announced', {
        betAmount,
        winnerId,
        winnerCard,
        totalWinnersSoFar: gameState.pendingWinners.length,
        message: `Player ${winnerCard} wins! (${gameState.pendingWinners.length} winners so far)`
    });
}
async function finalizeGame(io, betAmount, prizePool) {
    const gameState = activeGames.get(betAmount);
    if (!gameState) {
        console.log(`Cannot finalize game - no state found for betAmount: ${betAmount}`);
        return;
    }
    endGameCompletely(io, betAmount);
    const winners = gameState.pendingWinners;
    console.log(`Finalizing game for betAmount: ${betAmount} with ${winners.length} winners`);
    try {
        const sessions = await GameSession_1.default.find({ betAmount });
        const numberOfPlayers = sessions.length;
        const totalCollected = numberOfPlayers * betAmount;
        const totalPrizePool = totalCollected * 0.8; // 20% of total collected
        console.log(`Total collected: ${totalCollected}, Prize pool (20%): ${prizePool}`);
        // Use centralized cleanup function instead of direct deletion
        await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount });
        console.log(`Deleted sessions for betAmount: ${betAmount}`);
        //calculate system earning and agent commission
        const systemEarning = totalCollected * 0.2;
        // Agent commission per player = system earning / number of players
        const agentCommissionPerPlayer = systemEarning / numberOfPlayers;
        console.log(`Total collected: ${totalCollected}, System earning: ${systemEarning}, Commission per player: ${agentCommissionPerPlayer}`);
        // Loop through all players to pay agent commission
        for (const session of sessions) {
            const user = await User_1.default.findById(session.userId); // fetch user
            if (user && user.agent_id) {
                const agent = await User_1.default.findById(user.agent_id); // fetch agent
                if (agent) {
                    agent.wallet += agentCommissionPerPlayer;
                    agent.dailyEarnings += agentCommissionPerPlayer;
                    agent.weeklyEarnings += agentCommissionPerPlayer;
                    agent.totalEarnings += agentCommissionPerPlayer;
                    await agent.save();
                    console.log(`Agent ${agent._id} earned ${agentCommissionPerPlayer} from player ${user._id}`);
                }
            }
        }
        let prizePerWinner = 0;
        if (winners.length > 0) {
            prizePerWinner = totalPrizePool / winners.length;
            for (const winner of winners) {
                const user = await User_1.default.findById(winner.userId);
                if (user) {
                    user.wallet += prizePerWinner;
                    user.dailyEarnings += prizePerWinner;
                    user.weeklyEarnings += prizePerWinner;
                    user.totalEarnings += prizePerWinner;
                    await user.save();
                    console.log(`Updated wallet for user: ${winner.userId}, added ${prizePerWinner}`);
                }
                await GameHistory_1.default.create({
                    winnerId: winner.userId,
                    winnerCard: winner.card,
                    prizePool: prizePerWinner,
                    numberOfPlayers: numberOfPlayers,
                    betAmount: betAmount,
                    createdAt: new Date()
                });
            }
            console.log(`Broadcasting final results to all clients: ${winners.length} winners`);
            io.emit('game-ended', {
                winners: winners,
                prizePool: totalPrizePool,
                split: prizePerWinner,
                totalWinners: winners.length,
                betAmount: betAmount
            });
        }
        else {
            console.log('No winners found for this game');
            io.emit('game-ended', {
                winners: [],
                prizePool: 0,
                split: 0,
                totalWinners: 0,
                betAmount: betAmount
            });
        }
        activeGames.delete(betAmount);
        console.log(`Game state cleared for betAmount: ${betAmount}`);
        io.emit('sessions-updated', []);
    }
    catch (error) {
        console.error('Error finalizing game:', error);
        io.emit('error', { message: 'Failed to finalize game' });
    }
}
// Helper: attach user phones
async function enrichWithUserPhones(sessions) {
    const uniqueUserIds = Array.from(new Set(sessions.map(s => String(s.userId))));
    const users = await User_1.default.find({ _id: { $in: uniqueUserIds } }).select('phone');
    const phoneMap = new Map();
    users.forEach(u => { phoneMap.set(String(u._id), u.phone); });
    return sessions.map(s => ({
        ...s.toObject(),
        userId: { _id: s.userId, phone: phoneMap.get(String(s.userId)) || null }
    }));
}
function setupSocket(io) {
    // Initialize bet timers
    initializeBetTimers(io);
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query.token;
            if (!token)
                return next(new Error('Authentication error'));
            socket.userId = socket.handshake.query.userId;
            next();
        }
        catch {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id, 'User:', socket.userId);
        // Send current timer states immediately to newly connected client
        const initialTimerStates = {};
        betTimers.forEach((state, betAmount) => {
            initialTimerStates[betAmount] = { ...state };
        });
        socket.emit('timer-states-update', initialTimerStates);
        // === Fetch sessions ===
        socket.on('get-sessions', async (data) => {
            try {
                const betAmountIn = data.betOptions && data.betOptions.length
                    ? data.betOptions
                    : (data.betAmount !== undefined ? [data.betAmount] : undefined);
                const filter = { status: { $in: ['ready', 'active', 'playing', 'blocked'] } };
                if (betAmountIn)
                    filter.betAmount = { $in: betAmountIn };
                const sessions = await GameSession_1.default.find(filter);
                const enriched = await enrichWithUserPhones(sessions);
                // Update player counts for timers
                for (const session of sessions) {
                    await updateBetTimerStats(session.betAmount);
                }
                // Broadcast updated timer states
                broadcastTimerStates(io);
                socket.emit('sessions-updated', enriched);
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to get sessions' });
            }
        });
        // === Create session ===
        socket.on('create-session', async (data) => {
            try {
                const { userId, cardNumber, betAmount, createdAt } = data;
                if (userId !== socket.userId)
                    return socket.emit('error', { message: 'Unauthorized' });
                // Check if card is already taken by any user
                const existingCard = await GameSession_1.default.findOne({
                    cardNumber, betAmount, status: { $in: ['ready', 'active', 'playing'] }
                });
                if (existingCard)
                    return socket.emit('error', { message: 'Card already taken' });
                // ✅ NEW: Check if user already has 2 sessions for this bet amount
                const userSessionsCount = await GameSession_1.default.countDocuments({
                    userId,
                    betAmount,
                    status: { $in: ['ready', 'active', 'playing'] }
                });
                if (userSessionsCount >= 2) {
                    return socket.emit('error', {
                        message: 'You can only select maximum 2 cards per game'
                    });
                }
                // Ensure timer exists for this bet amount
                ensureBetTimerExists(betAmount);
                const created = await GameSession_1.default.create({
                    userId: new mongoose_1.default.Types.ObjectId(userId),
                    cardNumber,
                    betAmount,
                    status: 'active',
                    createdAt: new Date().toISOString()
                });
                // ✅ FIXED: Use enhanced update function with broadcast
                await updateBetTimerStats(betAmount, io);
                const populatedCreated = (await enrichWithUserPhones([created]))[0];
                const allSessions = await GameSession_1.default.find({ status: { $in: ['ready', 'active', 'playing'] } });
                const enrichedAll = await enrichWithUserPhones(allSessions);
                io.emit('session-created', populatedCreated);
                io.emit('sessions-updated', enrichedAll);
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to create session' });
            }
        });
        // === Clear selected ===
        socket.on('clear-selected', async ({ betAmount, userId }) => {
            try {
                if (!userId || socket.userId !== userId)
                    return socket.emit('error', { message: 'Unauthorized' });
                const sessions = await GameSession_1.default.find({
                    betAmount,
                    userId,
                    status: { $in: ['active', 'ready'] }
                });
                if (!sessions.length)
                    return socket.emit('error', { message: 'No sessions found' });
                const user = await User_1.default.findById(userId);
                // const deleteResult = await GameSession.deleteMany({
                //   betAmount,
                //   userId,
                //   status: 'active'
                // });
                // ✅ FIXED: Use centralized cleanup function
                await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount, userId });
                // Only stop game if this user was participating
                // const gameState = activeGames.get(betAmount);
                // if (gameState) {
                //   stopGameCalling(betAmount);
                //   endGameCompletely(io, betAmount);
                // }
                const updated = await GameSession_1.default.find({ status: { $in: ['ready', 'active', 'playing'] } });
                socket.emit('wallet-updated', user ? user.wallet : 0);
                io.emit('sessions-updated', await enrichWithUserPhones(updated));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to clear selected' });
            }
        });
        // === Refund Wallet ===
        socket.on('refund-wallet', async ({ betAmount, userId }) => {
            try {
                if (!userId || socket.userId !== userId) {
                    return socket.emit('error', { message: 'Unauthorized' });
                }
                // ✅ Include both 'ready' and 'playing' sessions
                const sessions = await GameSession_1.default.find({
                    betAmount,
                    userId,
                    status: { $in: ['ready', 'ready', 'playing'] }
                });
                if (!sessions.length) {
                    return socket.emit('error', { message: 'No sessions found' });
                }
                const totalRefund = betAmount * sessions.length;
                const user = await User_1.default.findById(userId);
                if (user) {
                    user.wallet += totalRefund;
                    await user.save();
                }
                // ✅ Use centralized cleanup
                await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount, userId });
                // ✅ End game only if it's active
                const gameState = activeGames.get(betAmount);
                if (gameState && !gameState.isGameEnded) {
                    stopGameCalling(betAmount);
                    endGameCompletely(io, betAmount);
                }
                socket.emit('wallet-updated', user ? user.wallet : 0);
                const updatedSessions = await GameSession_1.default.find({
                    status: { $in: ['active', 'playing', 'ready'] }
                });
                io.emit('sessions-updated', await enrichWithUserPhones(updatedSessions));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to refund wallet' });
            }
        });
        // === Fund Wallet ===
        socket.on('fund-wallet', async ({ betAmount, userId }) => {
            try {
                if (!userId || socket.userId !== userId)
                    return socket.emit('error', { message: 'Unauthorized' });
                const sessions = await GameSession_1.default.find({ betAmount, userId, status: 'active' });
                if (!sessions.length)
                    return socket.emit('error', { message: 'No sessions found' });
                const totalAmount = betAmount * sessions.length;
                const user = await User_1.default.findById(userId);
                if (!user)
                    return socket.emit('error', { message: 'User not found' });
                if (user.wallet < totalAmount)
                    return socket.emit('error', { message: 'Insufficient balance' });
                user.wallet -= totalAmount;
                await user.save();
                socket.emit('wallet-updated', user.wallet);
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to fund wallet' });
            }
        });
        // === Delete session ===
        socket.on('delete-session', async ({ cardNumber, betAmount }) => {
            try {
                if (!socket.userId)
                    return socket.emit('error', { message: 'Unauthorized' });
                const session = await GameSession_1.default.findOne({ cardNumber, betAmount, userId: socket.userId });
                if (!session)
                    return socket.emit('error', { message: 'Session not found' });
                const user = await User_1.default.findById(socket.userId);
                // ✅ FIXED: Use centralized cleanup function
                await cleanupSessionsAndUpdateStats(io, betAmount, {
                    cardNumber, betAmount, userId: socket.userId
                });
                const updated = await GameSession_1.default.find({ status: { $in: ['ready', 'active', 'playing'] } });
                socket.emit('wallet-updated', user ? user.wallet : 0);
                io.emit('sessions-updated', await enrichWithUserPhones(updated));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to delete session' });
            }
        });
        // === Update session status ===
        socket.on('update-session-status', async ({ cardNumber, betAmount, status }) => {
            try {
                await GameSession_1.default.updateOne({ cardNumber, betAmount }, { status });
                // ✅ FIXED: Use enhanced update function with broadcast
                await updateBetTimerStats(betAmount, io);
                const updated = await GameSession_1.default.find({ status: { $in: ['ready', 'active', 'playing'] } });
                io.emit('sessions-updated', await enrichWithUserPhones(updated));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to update session' });
            }
        });
        socket.on('update-session-status-by-bet', async ({ betAmount, status }) => {
            try {
                // 1. Perform the update only on documents with status 'ready'
                const updateResult = await GameSession_1.default.updateMany({ betAmount, status: 'ready' }, { $set: { status: status } });
                // 2. Delete sessions with status 'active' and same betAmount
                const deleteResult = await GameSession_1.default.deleteMany({
                    betAmount,
                    status: 'active'
                });
                // ✅ FIXED: Use enhanced update function with broadcast
                await updateBetTimerStats(betAmount, io);
                // 3. Find only the documents that were just updated (now have the new status)
                const updatedSessions = await GameSession_1.default.find({
                    betAmount,
                    status: status
                });
                // 4. Emit the list of updated sessions
                io.emit('sessions-updated', await enrichWithUserPhones(updatedSessions));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to update sessions by bet' });
            }
        });
        socket.on('update-session-status-by-user-bet', async ({ userId, betAmount, status }) => {
            try {
                await GameSession_1.default.updateMany({ userId, betAmount }, { status });
                // ✅ FIXED: Use enhanced update function with broadcast
                await updateBetTimerStats(betAmount, io);
                const updated = await GameSession_1.default.find({ betAmount, status: { $in: ['ready', 'active', 'playing'] } });
                io.emit('sessions-updated', await enrichWithUserPhones(updated));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to update session by user+bet' });
            }
        });
        socket.on('update-ready-sessions-by-bet', async ({ betAmount, status }) => {
            try {
                await GameSession_1.default.updateMany({ betAmount, status: 'ready' }, { status });
                // ✅ FIXED: Use enhanced update function with broadcast
                await updateBetTimerStats(betAmount, io);
                const updated = await GameSession_1.default.find({ status: { $in: ['active', 'playing'] } });
                io.emit('sessions-updated', await enrichWithUserPhones(updated));
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to update ready sessions' });
            }
        });
        // === Game control ===
        socket.on('start-game', ({ betAmount }) => {
            try {
                const gameState = activeGames.get(betAmount);
                if (!gameState || gameState.isGameEnded) {
                    startGameCalling(io, betAmount);
                }
                const currentGameState = getGameState(betAmount);
                if (currentGameState) {
                    socket.emit('game-state', {
                        betAmount,
                        calledNumbers: currentGameState.calledNumbers,
                        currentNumber: currentGameState.calledNumbers.slice(-1)[0] || ""
                    });
                }
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('get-game-state', ({ betAmount }) => {
            try {
                const gameState = getGameState(betAmount);
                if (gameState) {
                    socket.emit('game-state', {
                        betAmount,
                        calledNumbers: gameState.calledNumbers,
                        currentNumber: gameState.calledNumbers.slice(-1)[0] || ""
                    });
                }
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('stop-game', ({ betAmount }) => {
            try {
                stopGameCalling(betAmount);
                endGameCompletely(io, betAmount);
                io.emit('game-stopped', { betAmount });
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        // === End game / winners ===
        socket.on('end-game', async ({ betAmount, winnerId, winnerCard, prizePool }) => {
            try {
                console.log(`Winner submission received: ${winnerId}, card ${winnerCard}, betAmount: ${betAmount}`);
                const gameState = activeGames.get(betAmount);
                if (!gameState) {
                    console.log(`No active game for betAmount: ${betAmount}`);
                    return socket.emit('error', { message: 'No active game found' });
                }
                if (gameState.isGameEnded) {
                    console.log(`Game already fully ended for betAmount: ${betAmount}`);
                    return socket.emit('error', { message: 'Game has already ended' });
                }
                await handleWinnerSubmission(io, betAmount, winnerId, winnerCard, prizePool);
            }
            catch (error) {
                console.error('Error in end-game:', error);
                socket.emit('error', { message: error.message || 'Failed to process win' });
            }
        });
        // === Get timer states ===
        socket.on('get-timer-states', () => {
            try {
                const timerStates = {};
                betTimers.forEach((state, betAmount) => {
                    timerStates[betAmount] = { ...state };
                });
                socket.emit('timer-states-update', timerStates);
            }
            catch (error) {
                socket.emit('error', { message: error.message || 'Failed to get timer states' });
            }
        });
        // Remove get-remaining-time endpoint since we're handling timing completely on server
        socket.on('get-remaining-time', async ({ betAmount }) => {
            try {
                // Find the earliest active session for this bet amount
                const earliestSession = await GameSession_1.default.findOne({
                    betAmount,
                    status: { $in: ['active', 'ready'] }
                }).sort({ createdAt: 1 });
                if (!earliestSession) {
                    // No active sessions, return initial time (45 seconds)
                    socket.emit('remaining-time', { betAmount, remainingTime: 45 });
                    return;
                }
                // Calculate remaining time based on the earliest session
                const sessionStartTime = new Date(earliestSession.createdAt).getTime();
                const currentTime = new Date().getTime();
                const elapsedSeconds = Math.floor((currentTime - sessionStartTime) / 1000);
                const remainingTime = Math.max(0, 45 - elapsedSeconds);
                socket.emit('remaining-time', { betAmount, remainingTime });
            }
            catch (error) {
                console.error('Error calculating remaining time:', error);
                socket.emit('error', { message: 'Failed to calculate remaining time' });
            }
        });
        // Add this inside your io.on('connection') handler in setupSocket.ts
        socket.on('get-server-time', (callback) => {
            try {
                const serverTime = Date.now();
                const response = {
                    serverTime: serverTime,
                    serverTimeISO: new Date(serverTime).toISOString()
                };
                if (typeof callback === 'function') {
                    callback(response);
                }
            }
            catch (error) {
                console.error('Error getting server time:', error);
                if (typeof callback === 'function') {
                    callback({ error: 'Failed to get server time' });
                }
            }
        });
        socket.on('reset-game', async ({ betAmount }) => {
            try {
                stopGameCalling(betAmount);
                endGameCompletely(io, betAmount);
                activeGames.delete(betAmount);
                await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount }); // ✅ FIXED
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('test-game', async ({ betAmount }) => {
            try {
                stopGameCalling(betAmount);
                endGameCompletely(io, betAmount);
                activeGames.delete(betAmount);
                await cleanupSessionsAndUpdateStats(io, betAmount, { betAmount }); // ✅ FIXED
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('disconnect', (reason) => console.log('Client disconnected:', socket.id, 'Reason:', reason));
        socket.on('error', (error) => console.error('Socket error:', error));
    });
    console.log('Socket.io server setup complete with corrected data synchronization');
}
