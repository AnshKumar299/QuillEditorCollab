import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../Context/ToastContext";
import { Sun, Moon, Share2, X, Users, LogIn, Grid, List, Trash2, Copy } from "lucide-react";
import { io } from "socket.io-client";
import JoinRequestBanner from "../Components/JoinRequestBanner";
import logo from "../assets/logo.png";

const socket = io(import.meta.env.VITE_BACKEND_URL);

interface DocumentItem {
    _id: string;
    title: string;
    description?: string;
    createdAt?: string;
    updatedAt: string;
    fileSize?: number;
    lastEdited?: string;
    owner?: { username: string };
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [ownedDocuments, setOwnedDocuments] = useState<DocumentItem[]>([]);
    const [sharedDocuments, setSharedDocuments] = useState<DocumentItem[]>([]);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes <= 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const unit = (i >= 0 && i < sizes.length) ? sizes[i] : 'Bytes';
        const value = i >= 0 ? bytes / Math.pow(k, i) : bytes;
        return parseFloat(value.toFixed(dm)) + ' ' + unit;
    };

    const formatLastEdited = (dateStr?: string) => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "—";
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const executeDeleteDocument = async () => {
        if (!deleteDocId) return;
        try {
            const res = await axios.delete(
                `${import.meta.env.VITE_BACKEND_URL}/documents/${deleteDocId}`,
                { withCredentials: true }
            );
            if (res.data.status) {
                addToast("Document deleted successfully", "success");
                setOwnedDocuments(prev => prev.filter(doc => doc._id !== deleteDocId));
                setSharedDocuments(prev => prev.filter(doc => doc._id !== deleteDocId));
            } else {
                addToast(res.data.message || "Failed to delete document", "error");
            }
        } catch {
            addToast("Error deleting document", "error");
        } finally {
            setDeleteDocId(null);
        }
    };

    const handleCreateCopy = async (docId: string) => {
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/documents/${docId}/copy`,
                {},
                { withCredentials: true }
            );
            if (res.data.status) {
                addToast("Document copied successfully", "success");
                setOwnedDocuments(prev => [res.data.document, ...prev]);
            } else {
                addToast(res.data.message || "Failed to copy document", "error");
            }
        } catch {
            addToast("Error copying document", "error");
        }
    };

    // Join room state
    const [joinInput, setJoinInput] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [joiningStatus, setJoiningStatus] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [pendingRequest, setPendingRequest] = useState<{ requesterId: string; username: string; docId?: string } | null>(null);

    // Share modal state
    const [shareDocId, setShareDocId] = useState<string | null>(null);
    const [shareEmail, setShareEmail] = useState("");
    const [isSharing, setIsSharing] = useState(false);

    // Delete modal state
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

    const [isLightMode, setIsLightMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
            document.documentElement.classList.add('light');
            return true;
        }
        return false;
    });

    const toggleTheme = async () => {
        const nextLightMode = !isLightMode;
        setIsLightMode(nextLightMode);
        const nextTheme = nextLightMode ? 'light' : 'dark';
        if (nextLightMode) {
            document.documentElement.classList.add('light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.remove('light');
            localStorage.setItem('theme', 'dark');
        }
        try {
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/documents/settings/update`, { lastTheme: nextTheme }, { withCredentials: true });
        } catch (err) {
            console.error("Failed to save theme setting:", err);
        }
    };

    const handleToggleViewMode = async () => {
        const nextViewMode = viewMode === "grid" ? "list" : "grid";
        setViewMode(nextViewMode);
        try {
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/documents/settings/update`, { lastViewType: nextViewMode }, { withCredentials: true });
        } catch (err) {
            console.error("Failed to save view mode setting:", err);
        }
    };

    useEffect(() => {
        const verifyCookieAndFetchData = async () => {
            if (!localStorage.getItem("isLoggedIn")) {
                navigate("/login");
                return;
            }
            try {
                const authRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/`, {}, { withCredentials: true });
                if (authRes.data.status) {
                    setUsername(authRes.data.user);
                    const userData = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/getData`, {}, { withCredentials: true });
                    if (userData.data.success) {
                        setUserId(userData.data.user._id);
                    }
                    const docRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/documents/list`, { withCredentials: true });
                    if (docRes.data.status) {
                        setOwnedDocuments(docRes.data.ownedDocuments || []);
                        setSharedDocuments(docRes.data.sharedDocuments || []);
                    }
                    const settingsRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/documents/settings/get`, { withCredentials: true });
                    if (settingsRes.data.status && settingsRes.data.settings) {
                        const settings = settingsRes.data.settings;
                        if (settings.lastTheme) {
                            const isLight = settings.lastTheme === 'light';
                            setIsLightMode(isLight);
                            if (isLight) {
                                document.documentElement.classList.add('light');
                                localStorage.setItem('theme', 'light');
                            } else {
                                document.documentElement.classList.remove('light');
                                localStorage.setItem('theme', 'dark');
                            }
                        }
                        if (settings.lastViewType) {
                            setViewMode(settings.lastViewType);
                        }
                    }
                } else {
                    localStorage.removeItem("isLoggedIn");
                    navigate("/login");
                }
            } catch (err) {
                console.error(err);
                localStorage.removeItem("isLoggedIn");
                navigate("/login");
            } finally {
                setLoading(false);
            }
        };
        verifyCookieAndFetchData();
    }, [navigate]);

    const createDocument = async () => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/documents/create`, {}, { withCredentials: true });
            if (res.data.status) {
                navigate(`/edit/${res.data.document._id}`);
            }
        } catch (err) {
            console.error(err);
            addToast("Failed to create document", "error");
        }
    };

    // ── Socket Listeners ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!username) return;

        socket.on("join-request", ({ requesterId, username: requesterName, docId }) => {
            setPendingRequest({ requesterId, username: requesterName, docId });
        });

        socket.on("join-approved", ({ docId }) => {
            if (isJoining) {
                setJoiningStatus("Approved! Joining...");
                setTimeout(() => {
                    navigate(`/edit/${docId}`);
                    setIsJoining(false);
                    setJoiningStatus(null);
                }, 1000);
            }
        });

        socket.on("join-denied", ({ message }) => {
            if (isJoining) {
                addToast(message || "Join request was denied", "error");
                setIsJoining(false);
                setJoiningStatus(null);
            }
        });

        socket.on("join-pending", ({ message }) => {
            if (isJoining) {
                addToast(message, "info");
                setIsJoining(false);
                setJoiningStatus(null);
            }
        });

        return () => {
            socket.off("join-request");
            socket.off("join-approved");
            socket.off("join-denied");
            socket.off("join-pending");
        };
    }, [username, isJoining, navigate]);

    const handleJoinRoom = async () => {
        const trimmed = joinInput.trim();
        if (!trimmed) return;
        setIsJoining(true);
        setJoiningStatus("Checking document...");
        
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/documents/check/${trimmed}`);
            if (res.data.exists) {
                setJoiningStatus("Requesting access...");
                socket.emit("request-join", { docId: trimmed, username, userId });
            } else {
                addToast("No document found with that ID", "error");
                setIsJoining(false);
                setJoiningStatus(null);
            }
        } catch {
            addToast("Failed to check room. Try again.", "error");
            setIsJoining(false);
            setJoiningStatus(null);
        }
    };

    const handleRespondJoin = (approved: boolean) => {
        if (!pendingRequest) return;
        socket.emit("respond-join", {
            requesterId: pendingRequest.requesterId,
            approved,
            docId: pendingRequest.docId,
        });
        setPendingRequest(null);
        addToast(approved ? `Approved ${pendingRequest.username}` : `Denied ${pendingRequest.username}`, approved ? "success" : "info");
    };

    const handleShare = async () => {
        if (!shareEmail.trim() || !shareDocId) return;
        setIsSharing(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/documents/${shareDocId}/share`,
                { email: shareEmail.trim() },
                { withCredentials: true }
            );
            if (res.data.status) {
                addToast(res.data.message, "success");
                setShareDocId(null);
                setShareEmail("");
            } else {
                addToast(res.data.message || "Failed to share", "error");
            }
        } catch {
            addToast("Error sharing document", "error");
        } finally {
            setIsSharing(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono text-[var(--outline)]">Loading workspace…</span>
            </div>
        </div>
    );

    const DocCard = ({ doc, isOwned }: { doc: DocumentItem; isOwned: boolean }) => (
        <div
            onClick={() => navigate(`/edit/${doc._id}`)}
            className="group bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/10 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer transition-all flex flex-col justify-between aspect-[3/4] relative"
        >
            {/* Action buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                {isOwned ? (
                    <>
                        <button
                            onClick={() => { setShareDocId(doc._id); setShareEmail(""); }}
                            className="p-1.5 rounded-md text-[var(--outline)] hover:text-[var(--primary)] hover:bg-white/10 transition-all"
                            title="Share"
                        >
                            <Share2 size={14} />
                        </button>
                        <button
                            onClick={() => setDeleteDocId(doc._id)}
                            className="p-1.5 rounded-md text-[var(--outline)] hover:text-[var(--danger)] hover:bg-white/10 transition-all"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => handleCreateCopy(doc._id)}
                        className="p-1.5 rounded-md text-[var(--outline)] hover:text-[var(--primary)] hover:bg-white/10 transition-all"
                        title="Create a copy for myself"
                    >
                        <Copy size={14} />
                    </button>
                )}
            </div>

            <div>
                <h3 className="font-bold text-lg text-[var(--on-surface)] mb-1 truncate group-hover:text-[var(--primary)] transition-colors pr-14" title={doc.title}>
                    {doc.title}
                </h3>
                <p className="text-[10px] text-[var(--outline)] font-mono mb-2 truncate">
                    Last edited: <span className="font-semibold text-[var(--on-surface-variant)]">{formatLastEdited(doc.lastEdited || doc.updatedAt)}</span>
                </p>
                {doc.description ? (
                    <p className="text-xs text-[var(--on-surface-variant)] line-clamp-3 leading-relaxed">
                        {doc.description}
                    </p>
                ) : (
                    <p className="text-xs text-[var(--outline)] italic">No description</p>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <p className="text-[10px] text-[var(--outline)] font-medium uppercase font-mono tracking-wider truncate">
                        Created: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : (doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "N/A")}
                    </p>
                    <p className="text-[10px] text-[var(--outline)] font-medium uppercase font-mono tracking-wider truncate">
                        Size: {formatBytes(doc.fileSize || 0)}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)] mt-1 truncate">
                        {isOwned ? "by Me" : `by ${doc.owner?.username || "Unknown"}`}
                    </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] group-hover:text-[var(--primary)] group-hover:bg-[var(--surface-container-lowest)] transition-all text-sm shrink-0 self-end">
                    →
                </div>
            </div>
        </div>
    );

    const renderDocuments = (documents: DocumentItem[], isOwned: boolean) => {
        if (documents.length === 0) {
            return (
                <div className="text-center py-16 text-[var(--on-surface-variant)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                    <p className="text-base">{isOwned ? "No documents yet. Create one to get started!" : "No documents shared with you yet."}</p>
                </div>
            );
        }

        if (viewMode === "grid") {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {documents.map((doc) => (
                        <DocCard key={doc._id} doc={doc} isOwned={isOwned} />
                    ))}
                </div>
            );
        }

        // List View
        return (
            <div className="flex flex-col border border-[var(--outline-variant)] rounded-2xl bg-white/5 backdrop-blur-md overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                {/* Header Row */}
                <div className="flex items-center justify-between px-6 py-4 bg-white/10 border-b border-[var(--outline-variant)] text-xs font-bold text-[var(--outline)] uppercase font-mono tracking-wider">
                    <div className="flex-[2] min-w-0 pr-4">Document Title</div>
                    <div className="flex-1 hidden sm:block min-w-0 pr-4">Owner</div>
                    <div className="flex-1 hidden md:block min-w-0 pr-4">Created Date</div>
                    <div className="flex-1 hidden lg:block min-w-0 pr-4">File Size</div>
                    <div className="w-24 shrink-0 text-right">Actions</div>
                </div>
                
                {/* Content Rows */}
                {documents.map(doc => (
                    <div
                        key={doc._id}
                        onClick={() => navigate(`/edit/${doc._id}`)}
                        className="flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all text-sm text-[var(--on-surface)] group"
                    >
                        {/* Title / Description */}
                        <div className="flex-[2] min-w-0 pr-4 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-base truncate group-hover:text-[var(--primary)] transition-colors">{doc.title}</span>
                                <span className="text-[10px] bg-white/10 text-[var(--outline)] px-1.5 py-0.5 rounded font-mono shrink-0" title={`Last edited: ${formatLastEdited(doc.lastEdited || doc.updatedAt)}`}>
                                    Last edited: {formatLastEdited(doc.lastEdited || doc.updatedAt)}
                                </span>
                            </div>
                            <span className="text-xs text-[var(--on-surface-variant)] truncate">{doc.description || "No description"}</span>
                        </div>
                        
                        {/* Owner */}
                        <div className="flex-1 hidden sm:block min-w-0 pr-4 text-[var(--on-surface-variant)]">
                            {isOwned ? "Me" : (doc.owner?.username || "Unknown")}
                        </div>
                        
                        {/* Creation Date */}
                        <div className="flex-1 hidden md:block min-w-0 pr-4 text-[var(--on-surface-variant)] font-mono text-xs">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : (doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "N/A")}
                        </div>
                        
                        {/* File Size */}
                        <div className="flex-1 hidden lg:block min-w-0 pr-4 text-[var(--on-surface-variant)] font-mono text-xs">
                            {formatBytes(doc.fileSize || 0)}
                        </div>
                        
                        {/* Actions */}
                        <div className="w-24 shrink-0 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {isOwned ? (
                                <>
                                    <button
                                        onClick={() => { setShareDocId(doc._id); setShareEmail(""); }}
                                        className="p-2 rounded hover:bg-white/10 text-[var(--outline)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                                        title="Share"
                                    >
                                        <Share2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteDocId(doc._id)}
                                        className="p-2 rounded hover:bg-white/10 text-[var(--outline)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleCreateCopy(doc._id)}
                                    className="p-2 rounded hover:bg-white/10 text-[var(--outline)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                                    title="Create a copy for myself"
                                >
                                    <Copy size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col">
            {/* Header / Taskbar */}
            <header className="bg-[var(--surface-container-low)]/80 backdrop-blur-md border-b border-[var(--outline-variant)] px-6 py-3 flex justify-between items-center sticky top-0 z-10 gap-4">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
                    <h1 className="text-xl font-bold text-[var(--primary)] tracking-tight shrink-0">Collab Write</h1>
                </div>

                {/* Join Room Input */}
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                    {isJoining ? (
                        <div className="flex items-center gap-3 bg-[var(--surface-container-highest)] border border-[var(--primary)]/30 rounded-md px-4 py-2 w-full animate-pulse">
                            <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
                            <span className="text-xs font-medium text-[var(--primary)] truncate">{joiningStatus}</span>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 bg-[var(--input-bg)] border border-[var(--outline-variant)] rounded-md px-3 py-1.5 w-full focus-within:border-[var(--secondary-container)] focus-within:ring-1 focus-within:ring-[var(--secondary-container)] transition-all">
                                <LogIn size={14} className="text-[var(--outline)] shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Enter Room ID to join…"
                                    value={joinInput}
                                    onChange={(e) => setJoinInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                                    className="bg-transparent border-none outline-none text-sm text-[var(--on-surface)] placeholder-[var(--outline)] font-mono w-full"
                                />
                            </div>
                            <button
                                onClick={handleJoinRoom}
                                disabled={isJoining || !joinInput.trim()}
                                className="text-sm bg-[var(--primary-container)] text-[var(--on-primary-container)] px-3 py-1.5 rounded-md hover:bg-[var(--primary)] hover:text-[var(--on-primary)] transition-colors font-bold disabled:opacity-50 shrink-0"
                            >
                                Join
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-mono text-[var(--on-surface-variant)] hidden sm:inline">{username}</span>
                    <button onClick={toggleTheme} className="text-[var(--outline)] hover:text-[var(--primary)] transition-colors p-1.5 rounded hover:bg-[var(--surface-container-high)]" title="Toggle Theme">
                        {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button
                        onClick={() => { localStorage.removeItem("isLoggedIn"); navigate("/login"); }}
                        className="text-sm font-semibold text-[var(--danger)] hover:text-[var(--danger-hover)] transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="p-8 lg:p-12 max-w-7xl mx-auto w-full flex flex-col gap-12">

                {/* My Documents */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--primary)] tracking-tight">My Documents</h2>
                            <p className="text-xs text-[var(--outline)] mt-0.5">{ownedDocuments.length} document{ownedDocuments.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleToggleViewMode}
                                className="p-2 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--outline)] hover:text-[var(--primary)] hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                title={`Switch to ${viewMode === "grid" ? "List" : "Grid"} view`}
                            >
                                {viewMode === "grid" ? <List size={16} /> : <Grid size={16} />}
                                <span className="hidden sm:inline">{viewMode === "grid" ? "List View" : "Grid View"}</span>
                            </button>
                            <button
                                onClick={createDocument}
                                className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] px-5 py-2.5 text-sm font-bold rounded-md hover:shadow-[0_0_15px_var(--primary)] transition-all cursor-pointer"
                            >
                                + New Document
                            </button>
                        </div>
                    </div>

                    {renderDocuments(ownedDocuments, true)}
                </section>

                {/* Shared with Me */}
                <section>
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-[var(--primary)] tracking-tight flex items-center gap-2">
                            <Users size={18} /> Shared with Me
                        </h2>
                        <p className="text-xs text-[var(--outline)] mt-0.5">{sharedDocuments.length} document{sharedDocuments.length !== 1 ? "s" : ""}</p>
                    </div>

                    {renderDocuments(sharedDocuments, false)}
                </section>
            </main>

            {/* Share Modal */}
            {shareDocId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShareDocId(null)}>
                    <div className="bg-[var(--surface-container-high)] border border-[var(--outline-variant)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
                            <h3 className="font-bold text-[var(--on-surface)] flex items-center gap-2">
                                <Share2 size={16} className="text-[var(--primary)]" /> Share Document
                            </h3>
                            <button onClick={() => setShareDocId(null)} className="text-[var(--outline)] hover:text-[var(--danger)] transition-colors p-1 rounded">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <p className="text-sm text-[var(--on-surface-variant)]">Enter the email address of the person you want to share this document with.</p>
                            <input
                                type="email"
                                placeholder="user@example.com"
                                value={shareEmail}
                                onChange={e => setShareEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleShare()}
                                autoFocus
                                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--outline-variant)] rounded-md text-[var(--on-surface)] placeholder-[var(--outline)] focus:outline-none focus:border-[var(--secondary-container)] focus:ring-1 focus:ring-[var(--secondary-container)] transition-all text-sm"
                            />
                            <button
                                onClick={handleShare}
                                disabled={isSharing || !shareEmail.trim()}
                                className="w-full py-2.5 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] text-sm font-bold rounded-md hover:shadow-[0_0_15px_var(--primary)] transition-all disabled:opacity-50"
                            >
                                {isSharing ? "Sharing…" : "Share"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {deleteDocId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteDocId(null)}>
                    <div className="bg-[var(--surface-container-high)] border border-[var(--outline-variant)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                            <h3 className="font-bold text-[var(--danger)] flex items-center gap-2">
                                <Trash2 size={16} /> Delete Document
                            </h3>
                            <button onClick={() => setDeleteDocId(null)} className="text-[var(--outline)] hover:text-[var(--danger)] transition-colors p-1 rounded">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-6">
                            <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
                                Are you sure you want to delete this document? This action is permanent and cannot be undone.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setDeleteDocId(null)}
                                    className="flex-1 py-2 bg-[var(--surface-container-highest)] hover:bg-white/10 text-[var(--on-surface)] text-sm font-semibold rounded-md border border-[var(--outline-variant)] transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDeleteDocument}
                                    className="flex-1 py-2 bg-gradient-to-br from-[var(--danger)] to-red-600 hover:shadow-[0_0_15px_var(--danger)] text-white text-sm font-bold rounded-md transition-all cursor-pointer"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Join Request Banner */}
            <JoinRequestBanner pendingRequest={pendingRequest} onRespond={handleRespondJoin} />
        </div>
    );
};

export default Dashboard;
