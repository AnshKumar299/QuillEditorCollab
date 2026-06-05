import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
// @ts-expect-error - quill-image-resize-module-react does not have type definitions
import ImageResize from "quill-image-resize-module-react";
import { Quill } from "react-quill";
import { useEffect, useRef } from "react";
import Delta from "quill-delta";

Quill.register("modules/imageResize", ImageResize);

const modules = {
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
}

const formats = [
    "header", "bold", "italic", "underline", "strike",
    "blockquote", "code-block", "list", "script", "indent",
    "direction", "size", "color", "background", "font",
    "align", "link", "image", "video", "clean",
];

const Edit = ({ delta, socket, quillRef, currentRoom }: any) => {
    const isApplyingRemote = useRef(false);
    const versionRef = useRef<number>(0);
    const inflightDeltaRef = useRef<Delta | null>(null);
    const pendingDeltaRef = useRef<Delta | null>(null);

    // Initial load from parent component state (which is fetched on room join)
    useEffect(() => {
        if (quillRef.current && delta) {
            const ops = Array.isArray(delta.ops) ? delta.ops : (Array.isArray(delta) ? delta : null);
            if (ops) {
                isApplyingRemote.current = true;
                quillRef.current.getEditor().setContents(new Delta(ops));
                isApplyingRemote.current = false;
            }
        }
    }, [delta, quillRef]);

    useEffect(() => {
        if (!quillRef.current || !socket) return;
        const editor = quillRef.current.getEditor();
        const docId = window.location.pathname.split('/').pop();

        // 1. Listen to document load/initialization to set version
        const handleLoadDocument = (data: any) => {
            versionRef.current = data.version || 0;
            inflightDeltaRef.current = null;
            pendingDeltaRef.current = null;
        };

        // 2. Listen to force-resync from server
        const handleForceResync = (data: any) => {
            isApplyingRemote.current = true;
            editor.setContents(new Delta(data.content || []));
            versionRef.current = data.version || 0;
            inflightDeltaRef.current = null;
            pendingDeltaRef.current = null;
            isApplyingRemote.current = false;
        };

        // 3. Listen to ACKs from server
        const handleAckDelta = ({ version }: { version: number }) => {
            versionRef.current = version;
            inflightDeltaRef.current = null;

            // Send pending delta if any edits accumulated during flight
            if (pendingDeltaRef.current) {
                inflightDeltaRef.current = pendingDeltaRef.current;
                pendingDeltaRef.current = null;
                const targetRoom = currentRoom || docId;
                if (targetRoom) {
                    socket.emit("send-delta", {
                        docId: targetRoom,
                        delta: inflightDeltaRef.current.ops,
                        clientVersion: versionRef.current
                    });
                }
            }
        };

        // 4. Capture local user edits
        const handleTextChange = (deltaChange: any, _oldDelta: any, source: string) => {
            if (source !== 'user' || isApplyingRemote.current) return;
            const targetRoom = currentRoom || docId;
            if (!targetRoom) return;

            const change = new Delta(deltaChange.ops);

            if (inflightDeltaRef.current) {
                // Buffer changes into pendingDelta
                pendingDeltaRef.current = pendingDeltaRef.current
                    ? pendingDeltaRef.current.compose(change)
                    : change;
            } else {
                // Send immediately
                inflightDeltaRef.current = change;
                socket.emit("send-delta", {
                    docId: targetRoom,
                    delta: change.ops,
                    clientVersion: versionRef.current
                });
            }
        };

        socket.on("load-document", handleLoadDocument);
        socket.on("force-resync", handleForceResync);
        socket.on("ack-delta", handleAckDelta);
        editor.on('text-change', handleTextChange);

        return () => {
            socket.off("load-document", handleLoadDocument);
            socket.off("force-resync", handleForceResync);
            socket.off("ack-delta", handleAckDelta);
            editor.off('text-change', handleTextChange);
        };
    }, [socket, quillRef, currentRoom]);

    // 5. Receive remote edits (kept in separate effect to register listener only once)
    useEffect(() => {
        if (!quillRef.current || !socket) return;
        const editor = quillRef.current.getEditor();

        const handleReceiveDelta = ({ delta: remoteOps, version, senderId }: any) => {
            if (senderId === socket.id) return;

            let incomingDelta = new Delta(remoteOps);
            versionRef.current = version;

            isApplyingRemote.current = true;

            // Transform incoming delta against our local unacknowledged changes
            if (inflightDeltaRef.current) {
                incomingDelta = inflightDeltaRef.current.transform(incomingDelta, false);
            }
            if (pendingDeltaRef.current) {
                incomingDelta = pendingDeltaRef.current.transform(incomingDelta, false);
            }

            // Apply transformed remote delta to editor
            editor.updateContents(incomingDelta);
            isApplyingRemote.current = false;

            // Transform our local changes against the incoming remote delta to keep offsets aligned
            if (inflightDeltaRef.current) {
                inflightDeltaRef.current = incomingDelta.transform(inflightDeltaRef.current, true);
            }
            if (pendingDeltaRef.current) {
                pendingDeltaRef.current = incomingDelta.transform(pendingDeltaRef.current, true);
            }
        };

        socket.on('receive-delta', handleReceiveDelta);
        return () => {
            socket.off('receive-delta', handleReceiveDelta);
        };
    }, [socket, quillRef]);

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
    )
}

export default Edit;