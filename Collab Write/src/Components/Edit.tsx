import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from "quill-image-resize-module-react";
import { Quill } from "react-quill";
import { useState, useEffect } from "react";

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

const Edit = ({ delta, setDelta, socket, quillRef, currentRoom }: any) => {

    useEffect(() => {
        if (quillRef.current && delta && delta.ops) {
            quillRef.current.getEditor().setContents(delta);
        }
    }, [delta, quillRef]);

    useEffect(() => {
        if (!quillRef.current || !socket) return;
        const editor = quillRef.current.getEditor();
        
        const handleChange = (deltaChange: any, oldDelta: any, source: string) => {
            if (source !== 'user') return;
            const docId = window.location.pathname.split('/').pop();
            
            if (docId) {
                // Save the full content to MongoDB
                const fullContent = editor.getContents();
                socket.emit("save-document", docId, fullContent);
            }
            
            // Broadcast changes to the room the user is currently in (or fallback to docId)
            const targetRoom = currentRoom || docId;
            if (targetRoom) {
                socket.emit("send-delta", targetRoom, deltaChange);
            }
        };

        editor.on('text-change', handleChange);
        return () => {
            editor.off('text-change', handleChange);
        };
    }, [socket, quillRef]);

    return (
        <div className="flex flex-col h-full">
            <ReactQuill
                modules={modules}
                formats={formats}
                defaultValue={""}
                placeholder="Start writing..."
                theme="snow"
                className="flex flex-col grow"
                ref={quillRef}
            />
        </div>
    )
}

export default Edit;