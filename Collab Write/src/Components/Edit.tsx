import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from "quill-image-resize-module-react";
import { Quill } from "react-quill";
import { useState } from "react";

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

    clipboard: {
        matchVisual: false,
    },
    imageResize: {},
}

const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "code-block",
    "list",
    "script",
    "indent",
    "direction",
    "size",
    "color",
    "background",
    "font",
    "align",
    "link",
    "image",
    "video",
    "clean",
];

const Edit = () => {
    const [content, setContent] = useState("");

    return (
        <main className="max-w-4xl w-full mx-auto py-6 sm:py-10 px-4 sm:px-6 xl:px-0 flex-grow">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-md overflow-hidden flex flex-col min-h-[75vh]">
                <ReactQuill
                    modules={modules}
                    formats={formats}
                    value={content}
                    onChange={setContent}
                    placeholder="Start typing your masterpiece..."
                    theme="snow"
                    className="
                        flex flex-col grow
                        [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-200 [&_.ql-toolbar]:bg-slate-50/50 [&_.ql-toolbar]:px-4 [&_.ql-toolbar]:py-3 [&_.ql-toolbar]:rounded-t-2xl
                        [&_.ql-container]:border-none [&_.ql-container]:grow [&_.ql-container]:text-lg [&_.ql-container]:flex [&_.ql-container]:flex-col
                        [&_.ql-editor]:grow [&_.ql-editor]:px-6 sm:[&_.ql-editor]:px-12 md:[&_.ql-editor]:px-16 [&_.ql-editor]:py-10 [&_.ql-editor]:leading-relaxed [&_.ql-editor]:text-slate-700 
                        [&_.ql-editor_p]:mb-4 [&_.ql-editor_h1]:text-3xl [&_.ql-editor_h1]:font-bold [&_.ql-editor_h1]:mb-6
                        [&_.ql-editor_h2]:text-2xl [&_.ql-editor_h2]:font-bold [&_.ql-editor_h2]:mb-4
                    "
                />
            </div>
        </main>
    )
}

export default Edit;