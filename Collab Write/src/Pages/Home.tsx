import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useToast } from "../Context/ToastContext";
import Edit from "../Components/Edit.tsx";
import Navbar from "../Components/Navbar.tsx";
import LogsSidebar from "../Components/LogsSidebar.tsx";
import { io } from "socket.io-client";
import JoinRequestBanner from "../Components/JoinRequestBanner";
import * as quillToWord from "quill-to-word";

const socket = io(import.meta.env.VITE_BACKEND_URL, { autoConnect: false });

const Home = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { addToast } = useToast();

    const [isVerified, setIsVerified] = useState(false);
    const [username, setUsername] = useState("");
    const [userId, setUserId] = useState("");
    const usernameRef = useRef("");
    useEffect(() => { usernameRef.current = username; }, [username]);

    const [currentRoom, setCurrentRoom] = useState("");
    const [delta, setDelta] = useState({});
    const [docTitle, setDocTitle] = useState("Untitled");
    const [description, setDescription] = useState("");
    const [ownerUsername, setOwnerUsername] = useState("");
    const [ownerId, setOwnerId] = useState("");
    const quillRef = useRef<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    // User lists for sidebar
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<string[]>([]);

    // Join request approval (for owner)
    const [pendingRequest, setPendingRequest] = useState<{ requesterId: string; username: string } | null>(null);

    useEffect(() => {
        setLogs([]);
        setDelta({});
    }, [currentRoom]);

    // ── Socket listeners (mounted once) ───────────────────────────────────────
    useEffect(() => {
        socket.connect();

        socket.on("load-document", (data) => {
            if (data.content) setDelta(data.content);
            if (data.title) setDocTitle(data.title);
            if (data.description !== undefined) setDescription(data.description);
            if (data.ownerUsername) setOwnerUsername(data.ownerUsername);
            if (data.ownerId) setOwnerId(data.ownerId);
        });

        socket.on("document-renamed", (user, newTitle) => {
            setDocTitle(newTitle);
            setLogs((prev) => [...prev, { type: 'log', text: `${user} renamed the file to "${newTitle}"` }]);
        });

        socket.on("description-updated", (newDesc) => {
            setDescription(newDesc);
        });

        socket.on("user-joined", (userId) => {
            setLogs((prev) => [...prev, { type: 'log', text: `${userId} joined the room` }]);
        });

        socket.on("user-left", (userId) => {
            setLogs((prev) => [...prev, { type: 'log', text: `${userId} left the room` }]);
        });

        socket.on("receive-chat-message", (user, msg) => {
            setLogs((prev) => [...prev, { type: 'message', user, text: msg }]);
        });

        socket.on("user-lists-update", ({ activeUsers: au, allUsers: all }) => {
            setActiveUsers(au);
            setAllUsers(all);
        });

        // Owner receives join requests
        socket.on("join-request", ({ requesterId, username: requesterName }) => {
            setPendingRequest({ requesterId, username: requesterName });
        });

        // Requester: approved → proceed to join
        socket.on("join-approved", ({ docId }) => {
            socket.emit("join-room", docId, usernameRef.current);
            setCurrentRoom(docId);
            addToast(`Joined document`, "success");
        });

        // Requester: pending (owner offline)
        socket.on("join-pending", ({ message }) => {
            addToast(message, "info");
            navigate("/");
        });

        // Requester: denied
        socket.on("join-denied", ({ message }) => {
            addToast(message || "Join request was denied", "error");
            navigate("/");
        });

        return () => {
            socket.off("load-document");
            socket.off("document-renamed");
            socket.off("description-updated");
            socket.off("user-joined");
            socket.off("user-left");
            socket.off("receive-chat-message");
            socket.off("user-lists-update");
            socket.off("join-request");
            socket.off("join-approved");
            socket.off("join-denied");
            socket.off("join-pending");
            socket.disconnect();
        };
    }, []);

    // ── Auth verification + kick off join request ─────────────────────────────
    useEffect(() => {
        const verifyCookie = async () => {
            if (!localStorage.getItem("isLoggedIn")) {
                // Save the current URL so after login the user comes back here
                localStorage.setItem("returnUrl", window.location.pathname);
                navigate("/login");
                return;
            }
            try {
                const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/`, {}, { withCredentials: true });
                const { status, user } = data;
                if (status) {
                    setIsVerified(true);
                    setUsername(user);
                    addToast(`Welcome back, ${user}`, "success");
                } else {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.setItem("returnUrl", window.location.pathname);
                    navigate("/login");
                }
            } catch {
                localStorage.removeItem("isLoggedIn");
                localStorage.setItem("returnUrl", window.location.pathname);
                navigate("/login");
            }
        };
        verifyCookie();
    }, [navigate]);

    // ── Once verified + id available, fetch userId and request join ───────────
    useEffect(() => {
        if (!isVerified || !id || !username) return;

        // Fetch the user's _id for socket auth
        const fetchAndJoin = async () => {
            try {
                const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/getData`, {}, { withCredentials: true });
                if (data.success && data.user) {
                    const uId = data.user._id;
                    setUserId(uId);
                    socket.emit("request-join", { docId: id, username, userId: uId });
                } else {
                    // Fallback: join without userId (auto-approve)
                    socket.emit("request-join", { docId: id, username, userId: null });
                }
            } catch {
                socket.emit("request-join", { docId: id, username, userId: null });
            }
        };

        fetchAndJoin();
    }, [isVerified, id, username]);

    if (!isVerified) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[var(--text-muted)] font-mono">Authenticating…</p>
                </div>
            </div>
        );
    }

    const handleSendMessage = (msg: string) => {
        const room = currentRoom || id;
        if (!room || !msg.trim()) return;
        socket.emit("chat-message", room, username, msg);
        setLogs((prev) => [...prev, { type: 'message', user: username, text: msg }]);
    };

    const handleDownload = async () => {
        if (!quillRef.current) return;
        const quillDelta = quillRef.current.getEditor().getContents();
        const doc = await quillToWord.generateWord(quillDelta, { exportAs: 'blob' });

        const url = window.URL.createObjectURL(doc as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docTitle || 'document'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast("Document downloaded!", "success");
    };

    const handleDownloadPdf = () => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const htmlContent = editor.root.innerHTML;

        // Collect all stylesheet hrefs from the page (includes Quill's snow theme)
        const styleLinks = Array.from(document.styleSheets)
            .map(s => { try { return s.href ? `<link rel="stylesheet" href="${s.href}">` : ""; } catch { return ""; } })
            .join("");

        const printWindow = window.open("", "_blank");
        if (!printWindow) { addToast("Allow pop-ups to download as PDF", "error"); return; }

        printWindow.document.write(`<!DOCTYPE html><html><head>
            <meta charset="utf-8">
            <title>${docTitle || 'document'}</title>
            ${styleLinks}
            <style>
                body { margin: 0; padding: 24px 48px; font-family: Arial, sans-serif; background: #fff; color: #111; }
                .ql-editor { padding: 0 !important; min-height: unset !important; box-shadow: none !important; border: none !important; }
                @media print { @page { margin: 20mm; } }
            </style>
        </head><body>
            <div class="ql-editor">${htmlContent}</div>
        </body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 400);
        addToast("Opening print dialog for PDF…", "info");
    };

    const handleRespondJoin = (approved: boolean) => {
        if (!pendingRequest) return;
        socket.emit("respond-join", {
            requesterId: pendingRequest.requesterId,
            approved,
            docId: currentRoom || id,
        });
        setPendingRequest(null);
        if (approved) {
            addToast(`Approved ${pendingRequest.username}`, "success");
        } else {
            addToast(`Denied ${pendingRequest.username}`, "info");
        }
    };

    const isOwner = username === ownerUsername;

    return (
        <div className="min-h-screen flex flex-col bg-[var(--surface)] text-[var(--on-surface)]">
            <Navbar
                username={username}
                socket={socket}
                currentRoom={currentRoom}
                setCurrentRoom={setCurrentRoom}
                docTitle={docTitle}
                setDocTitle={setDocTitle}
                onDownload={handleDownload}
                onDownloadPdf={handleDownloadPdf}
                description={description}
                setDescription={setDescription}
                isOwner={isOwner}
                docId={id || ""}
            />

            <main className="flex-1 flex bg-[var(--surface)] overflow-hidden relative bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)]">
                {/* Editor Container */}
                <div className="flex-1 flex justify-center p-4 sm:p-8 overflow-y-auto relative">
                    <div className="w-full max-w-5xl bg-[var(--surface-container-low)]/80 backdrop-blur-md border border-[var(--outline-variant)] rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-h-full relative overflow-hidden">
                        <Edit delta={delta} setDelta={setDelta} socket={socket} quillRef={quillRef} currentRoom={currentRoom} />
                    </div>
                </div>

                {/* Sidebar Container */}
                <div className="w-80 flex flex-col z-10 hidden md:flex shrink-0">
                    <LogsSidebar
                        logs={logs}
                        currentRoom={currentRoom}
                        onSendMessage={handleSendMessage}
                        activeUsers={activeUsers}
                        allUsers={allUsers}
                    />
                </div>
            </main>

            {/* Join Request Banner */}
            <JoinRequestBanner pendingRequest={pendingRequest} onRespond={handleRespondJoin} />
        </div>
    );
};

export default Home;
