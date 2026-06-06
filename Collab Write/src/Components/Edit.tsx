import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "quill-cursors/css";
import QuillCursors from "quill-cursors";
// @ts-expect-error - quill-image-resize-module-react does not have type definitions
import ImageResize from "quill-image-resize-module-react";
import { useEffect, useRef, useCallback } from "react";
import Delta from "quill-delta";

// ── Register Quill modules once at module scope ───────────────────────────────
// Must happen before any ReactQuill / Quill instance is created.
Quill.register("modules/cursors", QuillCursors);
Quill.register("modules/imageResize", ImageResize);

// ── Types ─────────────────────────────────────────────────────────────────────
interface CursorRange {
    index: number;
    length: number;
}

interface CursorMovedPayload {
    socketId: string;
    username: string;
    color: string;
    range: CursorRange | null;
}

interface CursorRemovePayload {
    socketId: string;
}

interface AckDeltaPayload {
    version: number;
}

interface EditProps {
    delta: any;
    socket: any;
    quillRef: React.RefObject<any>;
    currentRoom: string;
    username: string;
}

// ── Throttle (no external dep) ────────────────────────────────────────────────
// Guarantees at most one call per `delay` ms. Leading-edge — fires immediately
// on the first invocation, then ignores subsequent calls within the window.
function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let lastCall = 0;
    return function (this: unknown, ...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        }
    } as T;
}

// ── Quill config ──────────────────────────────────────────────────────────────
const modules = {
    cursors: {
        // Automatically transform remote cursor positions when local text changes
        // so they stay visually correct during concurrent edits.
        transformOnTextChange: true,
    },
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ script: "sub" }, { script: "super" }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ direction: "rtl" }],
        [{ size: ["small", "medium", "large", "huge"] }],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ align: [] }],
        ["link", "image", "video"],
        ["clean"],
    ],
    clipboard: { matchVisual: false },
    imageResize: {},
};

const formats = [
    "header", "bold", "italic", "underline", "strike",
    "blockquote", "code-block", "list", "script", "indent",
    "direction", "size", "color", "background", "font",
    "align", "link", "image", "video", "clean",
];

// ── Component ─────────────────────────────────────────────────────────────────
const Edit = ({ delta, socket, quillRef, currentRoom, username }: EditProps) => {
    // OT state — kept in refs to avoid stale closures in Quill event handlers
    const isApplyingRemote = useRef(false);
    const versionRef = useRef<number>(0);
    const inflightDeltaRef = useRef<Delta | null>(null);
    const pendingDeltaRef = useRef<Delta | null>(null);

    // Keep currentRoom in a ref so throttled/callback functions always read
    // the latest value without needing to be recreated on each room change.
    const currentRoomRef = useRef(currentRoom);
    useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getEditor = useCallback(() => {
        try { return quillRef.current?.getEditor() ?? null; } catch { return null; }
    }, [quillRef]);

    const getCursors = useCallback((): InstanceType<typeof QuillCursors> | null => {
        try { return getEditor()?.getModule("cursors") ?? null; } catch { return null; }
    }, [getEditor]);

    // ── Initial document load ─────────────────────────────────────────────────
    useEffect(() => {
        const editor = getEditor();
        if (!editor || !delta) return;
        const ops = Array.isArray(delta.ops) ? delta.ops : (Array.isArray(delta) ? delta : null);
        if (!ops) return;
        isApplyingRemote.current = true;
        editor.setContents(new Delta(ops));
        isApplyingRemote.current = false;
    }, [delta, getEditor]);

    // ── OT + cursor broadcast ─────────────────────────────────────────────────
    useEffect(() => {
        const editor = getEditor();
        if (!editor || !socket) return;

        // Throttled at 50 ms (~20 updates/sec max). Cursor events are
        // fire-and-forget; dropping frames here is acceptable and prevents
        // flooding the server during rapid mouse drags or arrow-key holds.
        const emitCursorUpdate = throttle((range: CursorRange | null) => {
            const room = currentRoomRef.current;
            if (!room) return;
            socket.emit("cursor-update", { docId: room, range });
        }, 50);

        // Server confirmed the join and sent the document snapshot
        const handleLoadDocument = (data: any) => {
            versionRef.current = data.version || 0;
            inflightDeltaRef.current = null;
            pendingDeltaRef.current = null;
            editor.enable(true);
            // Clear stale cursors from a previous session; peers will
            // re-broadcast via the cursor-sync-request we already sent them.
            getCursors()?.clearCursors();
        };

        // Server forced a full resync (client was too far behind)
        const handleForceResync = (data: any) => {
            isApplyingRemote.current = true;
            editor.setContents(new Delta(data.content || []));
            versionRef.current = data.version || 0;
            inflightDeltaRef.current = null;
            pendingDeltaRef.current = null;
            isApplyingRemote.current = false;
            editor.enable(true);
        };

        // Server acknowledged our delta; send any buffered pending delta
        const handleAckDelta = ({ version }: AckDeltaPayload) => {
            versionRef.current = version;
            inflightDeltaRef.current = null;
            if (pendingDeltaRef.current) {
                inflightDeltaRef.current = pendingDeltaRef.current;
                pendingDeltaRef.current = null;
                const room = currentRoomRef.current;
                if (room) {
                    socket.emit("send-delta", {
                        docId: room,
                        delta: inflightDeltaRef.current!.ops,
                        clientVersion: versionRef.current,
                    });
                }
            }
        };

        // User typed or pasted — OT send
        const handleTextChange = (deltaChange: any, _old: any, source: string) => {
            if (source !== "user" || isApplyingRemote.current) return;
            const room = currentRoomRef.current;
            if (!room) return;
            const change = new Delta(deltaChange.ops);
            if (inflightDeltaRef.current) {
                pendingDeltaRef.current = pendingDeltaRef.current
                    ? pendingDeltaRef.current.compose(change)
                    : change;
            } else {
                inflightDeltaRef.current = change;
                socket.emit("send-delta", {
                    docId: room,
                    delta: change.ops,
                    clientVersion: versionRef.current,
                });
            }
        };

        // Caret moved or text selected — broadcast cursor position
        // source === "user" filters out programmatic setContents/updateContents
        const handleSelectionChange = (range: CursorRange | null, _old: any, source: string) => {
            if (source !== "user") return;
            emitCursorUpdate(range); // null = editor blurred → hide cursor on peers
        };

        const handleJoinDenied = () => editor.enable(false);

        socket.on("load-document", handleLoadDocument);
        socket.on("force-resync", handleForceResync);
        socket.on("ack-delta", handleAckDelta);
        socket.on("join-denied", handleJoinDenied);
        editor.on("text-change", handleTextChange);
        editor.on("selection-change", handleSelectionChange);

        return () => {
            socket.off("load-document", handleLoadDocument);
            socket.off("force-resync", handleForceResync);
            socket.off("ack-delta", handleAckDelta);
            socket.off("join-denied", handleJoinDenied);
            editor.off("text-change", handleTextChange);
            editor.off("selection-change", handleSelectionChange);
        };
    }, [socket, getEditor, getCursors]);

    // ── Remote delta application ──────────────────────────────────────────────
    // Kept in a separate effect so this listener is registered once and doesn't
    // share a dependency array with the OT state refs above.
    useEffect(() => {
        const editor = getEditor();
        if (!editor || !socket) return;

        const handleReceiveDelta = ({ delta: remoteOps, version, senderId }: any) => {
            if (senderId === socket.id) return; // echo guard
            let incoming = new Delta(remoteOps);
            versionRef.current = version;
            isApplyingRemote.current = true;

            // Transform against unacknowledged local changes (OT)
            if (inflightDeltaRef.current) incoming = inflightDeltaRef.current.transform(incoming, false);
            if (pendingDeltaRef.current) incoming = pendingDeltaRef.current.transform(incoming, false);

            editor.updateContents(incoming);
            isApplyingRemote.current = false;

            // Keep local deltas aligned with the new baseline
            if (inflightDeltaRef.current) inflightDeltaRef.current = incoming.transform(inflightDeltaRef.current, true);
            if (pendingDeltaRef.current) pendingDeltaRef.current = incoming.transform(pendingDeltaRef.current, true);
        };

        socket.on("receive-delta", handleReceiveDelta);
        return () => socket.off("receive-delta", handleReceiveDelta);
    }, [socket, getEditor]);

    // ── Remote cursor management ──────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // A peer moved their caret or changed their selection
        const handleCursorMoved = ({ socketId, username: remoteUser, color, range }: CursorMovedPayload) => {
            const cursors = getCursors();
            if (!cursors) return;
            try {
                // createCursor is idempotent — safe to call on every update
                cursors.createCursor(socketId, remoteUser, color);
                // range === null hides the cursor (editor lost focus on their end)
                cursors.moveCursor(socketId, range as any);
            } catch (err) {
                console.warn("cursor-moved: failed to update cursor", err);
            }
        };

        // A peer left the room or disconnected — remove their cursor immediately
        const handleCursorRemove = ({ socketId }: CursorRemovePayload) => {
            try {
                getCursors()?.removeCursor(socketId);
            } catch {
                // Cursor may not exist if that user never moved after joining
            }
        };

        // A new user just joined — re-broadcast our current cursor so they see us
        const handleCursorSyncRequest = () => {
            const room = currentRoomRef.current;
            if (!room) return;
            try {
                const range = getEditor()?.getSelection() ?? null;
                socket.emit("cursor-update", { docId: room, range });
            } catch {
                // Editor may not be ready yet; the new user will see us on our
                // next natural selection-change event
            }
        };

        socket.on("cursor-moved", handleCursorMoved);
        socket.on("cursor-remove", handleCursorRemove);
        socket.on("cursor-sync-request", handleCursorSyncRequest);

        return () => {
            socket.off("cursor-moved", handleCursorMoved);
            socket.off("cursor-remove", handleCursorRemove);
            socket.off("cursor-sync-request", handleCursorSyncRequest);
        };
    }, [socket, getCursors, getEditor]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full">
            <ReactQuill
                modules={modules}
                formats={formats}
                defaultValue={""}
                placeholder=""
                theme="snow"
                className="flex flex-col grow"
                ref={quillRef}
            />
        </div>
    );
};

export default Edit;