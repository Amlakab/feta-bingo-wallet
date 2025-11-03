"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSessionRepo = void 0;
const redisClient_1 = __importStar(require("../lib/redisClient"));
const crypto_1 = require("crypto");
// Keys & indexes
const ALL_SESSIONS_SET = "sessions:all";
const SESSION_KEY = (id) => `session:${id}`;
const BET_SET = (bet) => `sessions:bet:${bet}`;
const STATUS_SET = (s) => `sessions:status:${s}`;
const USER_SET = (userId) => `sessions:user:${userId}`;
async function indexSession(session) {
    await redisClient_1.default.sAdd(ALL_SESSIONS_SET, session._id);
    await redisClient_1.default.sAdd(BET_SET(session.betAmount), session._id);
    await redisClient_1.default.sAdd(STATUS_SET(session.status), session._id);
    await redisClient_1.default.sAdd(USER_SET(session.userId), session._id);
}
async function deindexSession(session) {
    await redisClient_1.default.sRem(ALL_SESSIONS_SET, session._id);
    await redisClient_1.default.sRem(BET_SET(session.betAmount), session._id);
    await redisClient_1.default.sRem(STATUS_SET(session.status), session._id);
    await redisClient_1.default.sRem(USER_SET(session.userId), session._id);
}
async function readSession(id) {
    const raw = await redisClient_1.default.get(SESSION_KEY(id));
    return raw ? JSON.parse(raw) : null;
}
async function writeSession(session) {
    await redisClient_1.default.set(SESSION_KEY(session._id), JSON.stringify(session));
}
exports.GameSessionRepo = {
    async create(data) {
        await (0, redisClient_1.ensureRedis)();
        const now = new Date().toISOString();
        const session = {
            _id: (0, crypto_1.randomUUID)(),
            userId: data.userId,
            cardNumber: data.cardNumber,
            betAmount: data.betAmount,
            status: data.status ?? "active",
            createdAt: data.createdAt ?? now,
        };
        await writeSession(session);
        await indexSession(session);
        return session;
    },
    async find(filter = {}) {
        await (0, redisClient_1.ensureRedis)();
        let sessionIds = [];
        // If we have specific filters, use them to get IDs
        if (filter.betAmount !== undefined) {
            sessionIds = await redisClient_1.default.sMembers(BET_SET(filter.betAmount));
        }
        else if (filter.betAmountIn && filter.betAmountIn.length > 0) {
            const betPromises = filter.betAmountIn.map(bet => redisClient_1.default.sMembers(BET_SET(bet)));
            const betResults = await Promise.all(betPromises);
            sessionIds = Array.from(new Set(betResults.flat()));
        }
        else if (filter.userId) {
            sessionIds = await redisClient_1.default.sMembers(USER_SET(filter.userId));
        }
        else if (filter.statusIn && filter.statusIn.length > 0) {
            const statusPromises = filter.statusIn.map(status => redisClient_1.default.sMembers(STATUS_SET(status)));
            const statusResults = await Promise.all(statusPromises);
            sessionIds = Array.from(new Set(statusResults.flat()));
        }
        else {
            // Get all sessions if no specific filters
            sessionIds = await redisClient_1.default.sMembers(ALL_SESSIONS_SET);
        }
        // Read all sessions from the collected IDs
        const sessionsPromises = sessionIds.map(id => readSession(id));
        let sessions = (await Promise.all(sessionsPromises)).filter(Boolean);
        // Apply additional filters that couldn't be handled by Redis sets
        if (filter.userId && !filter.userId) {
            sessions = sessions.filter(s => s.userId === filter.userId);
        }
        if (filter.cardNumber !== undefined) {
            sessions = sessions.filter(s => s.cardNumber === filter.cardNumber);
        }
        if (filter.statusIn && filter.statusIn.length > 0) {
            sessions = sessions.filter(s => filter.statusIn.includes(s.status));
        }
        return sessions;
    },
    async findOne(filter) {
        const sessions = await this.find({
            betAmount: filter.betAmount,
            statusIn: filter.statusIn
        });
        return sessions.find(session => (filter.cardNumber === undefined || session.cardNumber === filter.cardNumber) &&
            (filter.userId === undefined || session.userId === filter.userId)) || null;
    },
    async findById(id) {
        await (0, redisClient_1.ensureRedis)();
        return await readSession(id);
    },
    async deleteById(id) {
        await (0, redisClient_1.ensureRedis)();
        const session = await readSession(id);
        if (!session)
            return;
        await deindexSession(session);
        await redisClient_1.default.del(SESSION_KEY(id));
    },
    async updateOne(filter, update) {
        const target = await this.findOne({
            cardNumber: filter.cardNumber,
            betAmount: filter.betAmount
        });
        if (!target)
            return null;
        const originalStatus = target.status;
        const updatedSession = { ...target, ...update };
        await writeSession(updatedSession);
        if (update.status && update.status !== originalStatus) {
            await redisClient_1.default.sRem(STATUS_SET(originalStatus), target._id);
            await redisClient_1.default.sAdd(STATUS_SET(updatedSession.status), target._id);
        }
        return updatedSession;
    },
    async updateMany(filter, update) {
        const sessions = await this.find({
            betAmount: filter.betAmount,
            userId: filter.userId,
            statusIn: filter.status ? [filter.status] : undefined
        });
        for (const session of sessions) {
            const originalStatus = session.status;
            const updatedSession = { ...session, ...update };
            await writeSession(updatedSession);
            if (update.status && update.status !== originalStatus) {
                await redisClient_1.default.sRem(STATUS_SET(originalStatus), session._id);
                await redisClient_1.default.sAdd(STATUS_SET(updatedSession.status), session._id);
            }
        }
        return sessions.length;
    },
    async deleteMany(filter) {
        const sessions = await this.find({
            betAmount: filter.betAmount,
            userId: filter.userId
        });
        for (const session of sessions) {
            await deindexSession(session);
            await redisClient_1.default.del(SESSION_KEY(session._id));
        }
        return sessions.length;
    }
};
