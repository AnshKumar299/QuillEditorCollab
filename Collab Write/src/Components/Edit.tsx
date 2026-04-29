import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from "quill-image-resize-module-react";
import { Quill } from "react-quill";
import { useEffect, useRef } from "react";

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
    // Prevent echo loops if ReactQuill overrides the source='api' to 'user'
    const isApplyingRemote = useRef(false);

    // Load document content when delta is set (initial load from server)
    useEffect(() => {
        if (quillRef.current && delta && delta.ops) {
            quillRef.current.getEditor().setContents(delta);
        }
    }, [delta]);

    useEffect(() => {
        if (!quillRef.current || !socket) return;
        const editor = quillRef.current.getEditor();
        const docId = window.location.pathname.split('/').pop();

        // --- SEND: Capture user changes and broadcast delta ---
        const handleTextChange = (deltaChange: any, _oldDelta: any, source: string) => {
            if (source !== 'user' || isApplyingRemote.current) return;
            const targetRoom = currentRoom || docId;
            if (targetRoom) {
                socket.emit("send-delta", targetRoom, deltaChange);
            }
        };

        // --- AUTO-SAVE: Debounced save to MongoDB every 2 seconds of inactivity ---
        let saveTimer: ReturnType<typeof setTimeout>;
        const handleSave = (_deltaChange: any, _oldDelta: any, source: string) => {
            if (source !== 'user' || isApplyingRemote.current) return;
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                if (docId) {
                    socket.emit("save-document", docId, editor.getContents());
                }
            }, 2000);
        };

        editor.on('text-change', handleTextChange);
        editor.on('text-change', handleSave);
        return () => {
            editor.off('text-change', handleTextChange);
            editor.off('text-change', handleSave);
            clearTimeout(saveTimer);
        };
    }, [socket, quillRef, currentRoom]);

    // --- RECEIVE: Separate effect so this listener is registered ONCE, not on every currentRoom change ---
    useEffect(() => {
        if (!quillRef.current || !socket) return;
        const editor = quillRef.current.getEditor();

        const handleReceiveDelta = (incomingDelta: any) => {
            isApplyingRemote.current = true;
            editor.updateContents(incomingDelta);

            // Reset the flag immediately after the sync updates have flushed
            setTimeout(() => {
                isApplyingRemote.current = false;
            }, 10);
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