"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryGameSessionRepo = void 0;
// repositories/memoryGameSessionRepo.ts
const uuid_1 = require("uuid");
const sessions = new Map();
exports.MemoryGameSessionRepo = {
    async find(filter) {
        return Array.from(sessions.values()).filter((s) => {
            if (filter.betAmountIn && !filter.betAmountIn.includes(s.betAmount))
                return false;
            if (filter.userId && filter.userId !== s.userId)
                return false;
            if (filter.statusIn && !filter.statusIn.includes(s.status))
                return false;
            return true;
        });
    },
    async findOne(filter) {
        return (Array.from(sessions.values()).find((s) => {
            if (filter.cardNumber !== undefined && filter.cardNumber !== s.cardNumber)
                return false;
            if (filter.betAmount !== undefined && filter.betAmount !== s.betAmount)
                return false;
            if (filter.userId && filter.userId !== s.userId)
                return false;
            if (filter.statusIn && !filter.statusIn.includes(s.status))
                return false;
            return true;
        }) || null);
    },
    async create(data) {
        const session = { _id: (0, uuid_1.v4)(), ...data };
        sessions.set(session._id, session);
        return session;
    },
    async updateOne(filter, update) {
        const s = Array.from(sessions.values()).find((ss) => ss.cardNumber === filter.cardNumber && ss.betAmount === filter.betAmount);
        if (s) {
            Object.assign(s, update);
            sessions.set(s._id, s);
        }
    },
    async updateMany(filter, update) {
        for (const s of sessions.values()) {
            let match = true;
            for (const k in filter) {
                if (s[k] !== filter[k])
                    match = false;
            }
            if (match) {
                Object.assign(s, update);
                sessions.set(s._id, s);
            }
        }
    },
    async deleteById(id) {
        sessions.delete(id);
    },
    async deleteMany(filter) {
        for (const [id, s] of sessions.entries()) {
            let match = true;
            for (const k in filter) {
                if (s[k] !== filter[k])
                    match = false;
            }
            if (match)
                sessions.delete(id);
        }
    },
};
