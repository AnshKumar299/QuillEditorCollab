// tests/otBuffer.test.ts
import { describe, it, expect } from "vitest";
import Delta from "quill-delta";
import { onLocalChange, onAck, onRemote, type OTBuffer } from "../util/otBuffer";

describe("OT client buffer", () => {
    it("sends immediately when no inflight", () => {
        const buf = { inflight: null, pending: null };
        const change = new Delta([{ insert: "a" }]);
        const { buffer, toSend } = onLocalChange(buf, change);
        expect(toSend?.ops).toEqual(change.ops);
        expect(buffer.inflight?.ops).toEqual(change.ops);
        expect(buffer.pending).toBeNull();
    });

    it("buffers into pending when inflight exists", () => {
        const inflight = new Delta([{ insert: "a" }]);
        const buf = { inflight, pending: null };
        const change = new Delta([{ retain: 1 }, { insert: "b" }]);
        const { buffer, toSend } = onLocalChange(buf, change);
        expect(toSend).toBeNull();
        expect(buffer.pending?.ops).toEqual(change.ops);
    });

    it("composes multiple pending changes", () => {
        const inflight = new Delta([{ insert: "a" }]);
        let buf: OTBuffer = { inflight, pending: null };
        buf = onLocalChange(buf, new Delta([{ retain: 1 }, { insert: "b" }])).buffer;
        buf = onLocalChange(buf, new Delta([{ retain: 2 }, { insert: "c" }])).buffer;
        // pending should be composed: "b" then "c"
        const expected = new Delta([{ retain: 1 }, { insert: "bc" }]);
        expect(buf.pending?.ops).toEqual(expected.ops);
    });

    it("flushes pending on ack", () => {
        const inflight = new Delta([{ insert: "a" }]);
        const pending = new Delta([{ retain: 1 }, { insert: "b" }]);
        const buf = { inflight, pending };
        const { buffer, toSend } = onAck(buf);
        expect(toSend?.ops).toEqual(pending.ops);
        expect(buffer.inflight?.ops).toEqual(pending.ops);
        expect(buffer.pending).toBeNull();
    });

    it("clears inflight on ack with no pending", () => {
        const buf = { inflight: new Delta([{ insert: "a" }]), pending: null };
        const { buffer, toSend } = onAck(buf);
        expect(toSend).toBeNull();
        expect(buffer.inflight).toBeNull();
    });

    it("transforms remote op against inflight and pending", () => {
        // Local inflight: insert "X" at 0. Remote: insert "Y" at 0.
        // toApply should be shifted past "X" → insert "Y" at 1.
        const inflight = new Delta([{ insert: "X" }]);
        const buf = { inflight, pending: null };
        const remote = new Delta([{ insert: "Y" }]);
        const { toApply } = onRemote(buf, remote);
        expect(toApply.ops).toEqual([{ retain: 1 }, { insert: "Y" }]);
    });

    it("retransforms inflight after remote apply", () => {
        // After remote inserts "Y" at 0, our inflight "X" at 0 should shift to 1
        const inflight = new Delta([{ insert: "X" }]);
        const buf = { inflight, pending: null };
        const remote = new Delta([{ insert: "Y" }]);
        const { buffer } = onRemote(buf, remote);
        expect(buffer.inflight?.ops).toEqual([{ retain: 1 }, { insert: "X" }]);
    });
});