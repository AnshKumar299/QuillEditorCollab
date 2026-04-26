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

const Edit = ({ delta, setDelta, socket, quillRef }: any) => {
    const [content, setContent] = useState("");

    useEffect(() => {
        if (quillRef.current && delta && delta.ops) {
            quillRef.current.getEditor().setContents(delta);
        }
    }, [delta, quillRef]);

    return (
        <div className="flex flex-col h-full">
            <ReactQuill
                modules={modules}
                formats={formats}
                value={content}
                onChange={setContent}
                placeholder="Start writing..."
                theme="snow"
                className="flex flex-col grow"
                ref={quillRef}
            />
        </div>
    )
}

export default Edit;