// src/util/otBuffer.ts
import Delta from "quill-delta";

export interface OTBuffer {
    inflight: Delta | null;
    pending: Delta | null;
}

export function onLocalChange(buffer: OTBuffer, change: Delta): { buffer: OTBuffer; toSend: Delta | null } {
    if (buffer.inflight) {
        return {
            buffer: { inflight: buffer.inflight, pending: buffer.pending ? buffer.pending.compose(change) : change },
            toSend: null,
        };
    }
    return { buffer: { inflight: change, pending: null }, toSend: change };
}

export function onAck(buffer: OTBuffer): { buffer: OTBuffer; toSend: Delta | null } {
    if (buffer.pending) {
        return { buffer: { inflight: buffer.pending, pending: null }, toSend: buffer.pending };
    }
    return { buffer: { inflight: null, pending: null }, toSend: null };
}

export function onRemote(buffer: OTBuffer, incoming: Delta): { buffer: OTBuffer; toApply: Delta } {
    let toApply = incoming;
    let { inflight, pending } = buffer;
    if (inflight) toApply = inflight.transform(toApply, true);
    if (pending) toApply = pending.transform(toApply, true);
    if (inflight) inflight = incoming.transform(inflight, true);
    if (pending) pending = incoming.transform(pending, true);
    return { buffer: { inflight, pending }, toApply };
}