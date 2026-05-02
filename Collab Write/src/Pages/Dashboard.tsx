import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../Context/ToastContext";
import { Sun, Moon, Share2, X, Users, LogIn } from "lucide-react";
import { io } from "socket.io-client";
import JoinRequestBanner from "../Components/JoinRequestBanner";

const socket = io(import.meta.env.VITE_BACKEND_URL);

interface DocumentItem {
    _id: string;
    title: string;
    description?: string;
    updatedAt: string;
    owner?: { username: string };
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [ownedDocuments, setOwnedDocuments] = useState<DocumentItem[]>([]);
    const [sharedDocuments, setSharedDocuments] = useState<DocumentItem[]>([]);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

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

    const [isLightMode, setIsLightMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
            document.documentElement.classList.add('light');
            return true;
        }
        return false;
    });

    const toggleTheme = () => {
        if (isLightMode) {
            document.documentElement.classList.remove('light');
            localStorage.setItem('theme', 'dark');
            setIsLightMode(false);
        } else {
            document.documentElement.classList.add('light');
            localStorage.setItem('theme', 'light');
            setIsLightMode(true);
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
            {/* Share button (owner only) */}
            {isOwned && (
                <button
                    onClick={(e) => { e.stopPropagation(); setShareDocId(doc._id); setShareEmail(""); }}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-[var(--outline)] hover:text-[var(--primary)] hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Share"
                >
                    <Share2 size={14} />
                </button>
            )}

            <div>
                <h3 className="font-bold text-lg text-[var(--on-surface)] mb-2 truncate group-hover:text-[var(--primary)] transition-colors pr-6" title={doc.title}>
                    {doc.title}
                </h3>
                {doc.description ? (
                    <p className="text-xs text-[var(--on-surface-variant)] line-clamp-3 leading-relaxed">
                        {doc.description}
                    </p>
                ) : (
                    <p className="text-xs text-[var(--outline)] italic">No description</p>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <div>
                    <p className="text-xs font-mono text-[var(--on-surface-variant)]">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                    {!isOwned && doc.owner && (
                        <p className="text-xs text-[var(--outline)] mt-0.5">by {doc.owner.username}</p>
                    )}
                </div>
                <div className="w-7 h-7 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] group-hover:text-[var(--primary)] group-hover:bg-[var(--surface-container-lowest)] transition-all text-sm">
                    →
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col">
            {/* Header / Taskbar */}
            <header className="bg-[var(--surface-container-low)]/80 backdrop-blur-md border-b border-[var(--outline-variant)] px-6 py-3 flex justify-between items-center sticky top-0 z-10 gap-4">
                <h1 className="text-xl font-bold text-[var(--primary)] tracking-tight shrink-0">Collab Write</h1>

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
                        <button
                            onClick={createDocument}
                            className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] px-5 py-2.5 text-sm font-bold rounded-md hover:shadow-[0_0_15px_var(--primary)] transition-all"
                        >
                            + New Document
                        </button>
                    </div>

                    {ownedDocuments.length === 0 ? (
                        <div className="text-center py-16 text-[var(--on-surface-variant)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                            <p className="text-base">No documents yet. Create one to get started!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {ownedDocuments.map((doc) => (
                                <DocCard key={doc._id} doc={doc} isOwned={true} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Shared with Me */}
                <section>
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-[var(--primary)] tracking-tight flex items-center gap-2">
                            <Users size={18} /> Shared with Me
                        </h2>
                        <p className="text-xs text-[var(--outline)] mt-0.5">{sharedDocuments.length} document{sharedDocuments.length !== 1 ? "s" : ""}</p>
                    </div>

                    {sharedDocuments.length === 0 ? (
                        <div className="text-center py-16 text-[var(--on-surface-variant)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                            <p className="text-base">No documents shared with you yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {sharedDocuments.map((doc) => (
                                <DocCard key={doc._id} doc={doc} isOwned={false} />
                            ))}
                        </div>
                    )}
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
            {/* Join Request Banner */}
            <JoinRequestBanner pendingRequest={pendingRequest} onRespond={handleRespondJoin} />
        </div>
    );
};

export default Dashboard;
