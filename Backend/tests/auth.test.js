// tests/auth.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { initSocket } from "../socket/index.js";
import { activeRooms, otRooms } from "../socket/state.js";

// Mock auth middleware to control what token means
vi.mock("../middlewares/SocketAuthMiddleware.js", () => ({
    socketAuthMiddleware: (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (token === "valid") {
            socket.userId = "user123";
            socket.user = { username: "alice" };
            return next();
        }
        next(new Error("Unauthorized"));
    },
}));

vi.mock("../models/Document.js", () => ({
    default: {
        findById: vi.fn().mockReturnValue({
            populate: vi.fn().mockReturnThis(),
            then: vi.fn(),
        }),
        findByIdAndUpdate: vi.fn().mockResolvedValue({}),
    },
}));

let httpServer, ioServer, port;

beforeAll(() => new Promise(resolve => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    initSocket(ioServer);
    httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
    });
}));

afterAll(() => new Promise(resolve => {
    ioServer.close();
    httpServer.close(resolve);
}));

afterEach(async () => {
    // Step 1: disconnect all clients that are still connected
    clients.forEach(c => {
        if (c.connected) c.disconnect();
    });

    // Step 2: wait for server-side disconnect events to propagate
    await new Promise(r => setTimeout(r, 50));

    // Step 3: now safe to clear state
    clients.length = 0;
    activeRooms.clear();
    otRooms.clear();
});

function connect(token) {
    const client = Client(`http://localhost:${port}`, {
        auth: { token },
        autoConnect: false,
    });
    clients.push(client);
    return client;
}
const clients = [];

describe("socket authentication", () => {
    it("rejects connection with no token", () => new Promise((resolve, reject) => {
        const client = connect(undefined);
        client.on("connect_error", (err) => {
            expect(err.message).toMatch(/unauthorized/i);
            client.disconnect();
            resolve();
        });
        client.on("connect", () => reject(new Error("should not connect")));
        client.connect();
    }));

    it("rejects connection with invalid token", () => new Promise((resolve, reject) => {
        const client = connect("badtoken");
        client.on("connect_error", (err) => {
            expect(err.message).toMatch(/unauthorized/i);
            client.disconnect();
            resolve();
        });
        client.on("connect", () => reject(new Error("should not connect")));
        client.connect();
    }));

    it("accepts connection with valid token", () => new Promise((resolve) => {
        const client = connect("valid");
        client.on("connect", () => {
            expect(client.connected).toBe(true);
            client.disconnect();
            resolve();
        });
        client.connect();
    }));
});