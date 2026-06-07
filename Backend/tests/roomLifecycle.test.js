// tests/roomLifecycle.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { activeRooms, otRooms, addUserToRoom, removeUserFromRoom, getRoomActiveUsers } from "../socket/state.js";

// Mock the Document model so no MongoDB connection is needed
vi.mock("../models/Document.js", () => ({
    default: {
        findByIdAndUpdate: vi.fn().mockResolvedValue({}),
    },
}));

import { checkAndCleanupRoom } from "../socket/cleanup.js";
import Delta from "quill-delta";

function makeRoom() {
    return {
        content: new Delta([{ insert: "hello" }]),
        version: 3,
        operations: [],
        queue: { enqueue: vi.fn() },
        saveTimer: null,
        lastEdited: new Date(),
    };
}

beforeEach(() => {
    activeRooms.clear();
    otRooms.clear();
});

describe("state helpers", () => {
    it("addUserToRoom creates the room map if absent", () => {
        addUserToRoom("room1", "socket1", "alice", "user123");
        expect(activeRooms.get("room1").get("socket1")).toEqual({ username: "alice", userId: "user123" });
    });

    it("removeUserFromRoom deletes the room map when empty", () => {
        addUserToRoom("room1", "socket1", "alice", "user123");
        removeUserFromRoom("room1", "socket1");
        expect(activeRooms.has("room1")).toBe(false);
    });

    it("getRoomActiveUsers returns correct list", () => {
        addUserToRoom("room1", "s1", "alice", "u1");
        addUserToRoom("room1", "s2", "bob", "u2");
        expect(getRoomActiveUsers("room1")).toContain("alice");
        expect(getRoomActiveUsers("room1")).toContain("bob");
    });

    it("getRoomActiveUsers returns [] for unknown room", () => {
        expect(getRoomActiveUsers("ghost")).toEqual([]);
    });
});

describe("checkAndCleanupRoom", () => {
    it("saves to DB and deletes room when no active users", async () => {
        const Document = (await import("../models/Document.js")).default;
        otRooms.set("room1", makeRoom());
        // No users added to activeRooms — room is empty

        await checkAndCleanupRoom("room1");

        expect(Document.findByIdAndUpdate).toHaveBeenCalledWith("room1", expect.objectContaining({
            version: 3,
        }));
        expect(otRooms.has("room1")).toBe(false);
    });

    it("does NOT delete room when active users remain", async () => {
        otRooms.set("room1", makeRoom());
        addUserToRoom("room1", "s1", "alice", "u1");

        await checkAndCleanupRoom("room1");

        expect(otRooms.has("room1")).toBe(true);
    });

    it("cancels saveTimer before final DB write", async () => {
        const room = makeRoom();
        const clearSpy = vi.spyOn(globalThis, "clearTimeout");
        room.saveTimer = setTimeout(() => { }, 99999);
        otRooms.set("room1", room);

        await checkAndCleanupRoom("room1");

        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});