// tests/ot.test.js
import { describe, it, expect, beforeEach } from "vitest";
import Delta from "quill-delta";

// Replicate the server-side transform logic as a pure function
// so we can test it without any infrastructure.
function applyDelta({ roomContent, roomVersion, roomOps, clientVersion, incomingOps }) {
    const incomingDelta = new Delta(incomingOps);

    // Force resync only if client is behind the oldest op we still have
    if (roomOps.length > 0 && clientVersion < roomOps[0].version - 1) {
        return { forceResync: true };
    }

    let transformed = incomingDelta;
    if (clientVersion < roomVersion) {
        const missed = roomOps.filter(op => op.version > clientVersion);
        for (const op of missed) {
            transformed = op.delta.transform(transformed, true);
        }
    }

    const newContent = roomContent.compose(transformed);
    const newVersion = roomVersion + 1;
    return { newContent, newVersion, transformed, forceResync: false };
}
describe("OT — basic apply", () => {
    it("applies a delta when client is in sync", () => {
        const content = new Delta([{ insert: "hello" }]);
        const result = applyDelta({
            roomContent: content,
            roomVersion: 3,
            roomOps: [],
            clientVersion: 3,
            incomingOps: [{ retain: 5 }, { insert: " world" }],
        });
        expect(result.forceResync).toBe(false);
        expect(result.newContent.ops).toEqual([{ insert: "hello world" }]);
        expect(result.newVersion).toBe(4);
    });

    it("transforms a lagging client delta against missed ops", () => {
        // Client at v1. Server already applied " world" insert at v2.
        // Client tries to insert "!" at position 5 (end of "hello").
        // After transform, "!" should land at position 11 (end of "hello world").
        const missedDelta = new Delta([{ retain: 5 }, { insert: " world" }]);
        const content = new Delta([{ insert: "hello world" }]);

        const result = applyDelta({
            roomContent: content,
            roomVersion: 2,
            roomOps: [{ version: 2, delta: missedDelta }],
            clientVersion: 1,
            incomingOps: [{ retain: 5 }, { insert: "!" }],
        });

        expect(result.forceResync).toBe(false);
        expect(result.newContent.ops).toEqual([{ insert: "hello world!" }]);
    });

    it("triggers force-resync when client is behind history window", () => {
        const content = new Delta([{ insert: "hello" }]);
        const result = applyDelta({
            roomContent: content,
            roomVersion: 15,
            roomOps: [{ version: 10, delta: new Delta() }],
            clientVersion: 5, // behind oldest stored op (v10)
            incomingOps: [{ insert: "x" }],
        });
        expect(result.forceResync).toBe(true);
    });

    it("version increments monotonically on each apply", () => {
        let content = new Delta([{ insert: "" }]);
        let version = 0;
        let ops = [];

        for (let i = 0; i < 5; i++) {
            const result = applyDelta({
                roomContent: content,
                roomVersion: version,
                roomOps: ops,
                clientVersion: version,
                incomingOps: [{ retain: i }, { insert: "a" }],
            });
            ops.push({ version: result.newVersion, delta: result.transformed });
            content = result.newContent;
            version = result.newVersion;
        }
        expect(version).toBe(5);
    });

    it("two concurrent inserts converge to same content", () => {
        // Classic OT convergence test.
        // Base: "hello". Client A inserts "X" at 0. Client B inserts "Y" at 0.
        // Server applies A first (v1), then transforms B against A.
        // Result should be deterministic: "XYhello".
        const base = new Delta([{ insert: "hello" }]);
        const deltaA = new Delta([{ insert: "X" }]);
        const deltaB = new Delta([{ insert: "Y" }]);

        // Apply A at v0
        const afterA = base.compose(deltaA); // "Xhello"

        // Transform B against A (A has priority=true)
        const transformedB = deltaA.transform(deltaB, true);
        const afterB = afterA.compose(transformedB); // "XYhello"

        // Apply B at v0, transform against A
        const result = applyDelta({
            roomContent: afterA,
            roomVersion: 1,
            roomOps: [{ version: 1, delta: deltaA }],
            clientVersion: 0,
            incomingOps: deltaB.ops,
        });

        expect(result.newContent.ops).toEqual(afterB.ops);
    });
});