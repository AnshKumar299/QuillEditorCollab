import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCookies } from "react-cookie";
import { toast } from "react-toastify";
import { Pencil, Check, Sun, Moon, Info, X, Download } from "lucide-react";

interface NavbarProps {
    username: string;
    socketId: string;
    socket: any;
    currentRoom: string;
    setCurrentRoom: (room: string) => void;
    docTitle?: string;
    setDocTitle?: (title: string) => void;
    onDownload?: () => void;
}

const Navbar = ({ username, socketId, socket, currentRoom, setCurrentRoom, docTitle, setDocTitle, onDownload }: NavbarProps) => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);

    const [joinInput, setJoinInput] = useState("");
    const [isEditingRoom, setIsEditingRoom] = useState(false);
    const [editRoomInput, setEditRoomInput] = useState("");
    const [isInfoOpen, setIsInfoOpen] = useState(false);
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

    const handleJoinRoom = () => {
        if (!joinInput.trim()) return;
        socket.emit("join-room", joinInput, username);
        setCurrentRoom(joinInput);
        setJoinInput("");
        toast.success(`Joined room: ${joinInput}`);
    };

    const handleRenameRoom = () => {
        if (editRoomInput === currentRoom) {
            setIsEditingRoom(false);
            return;
        }

        if (!editRoomInput.trim()) {
            socket.emit("leave-room", currentRoom, username);
            setCurrentRoom("");
            setIsEditingRoom(false);
            toast.info("Left the room");
            return;
        }

        socket.emit("leave-room", currentRoom, username);
        socket.emit("join-room", editRoomInput, username);
        setCurrentRoom(editRoomInput);
        setIsEditingRoom(false);
        toast.success(`Joined room: ${editRoomInput}`);
    };

    const handleTitleRename = (newTitle: string) => {
        if (!newTitle.trim() || !setDocTitle) return;
        setDocTitle(newTitle);
        const docId = window.location.pathname.split('/').pop();
        if (docId) {
            socket.emit("rename-document", docId, newTitle);
        }
    };

    return (
        <>
            <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]/80 backdrop-blur-md shrink-0 z-20">
            <div className="flex items-center gap-4">
                <Link to="/" className="text-lg font-bold text-[var(--primary)] tracking-tight hover:text-[var(--primary-container)] transition-colors">
                    Collab Write
                </Link>
                <span className="text-[var(--outline-variant)] text-lg font-light">/</span>
                <input
                    type="text"
                    value={docTitle || "Untitled"}
                    onChange={(e) => setDocTitle && setDocTitle(e.target.value)}
                    onBlur={(e) => handleTitleRename(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleTitleRename((e.target as HTMLInputElement).value);
                            e.currentTarget.blur();
                        }
                    }}
                    className="text-base text-[var(--on-surface)] bg-transparent border-none outline-none px-2 py-1 rounded hover:bg-white/5 focus:bg-white/5 w-32 sm:w-64 transition-colors font-medium focus:ring-1 focus:ring-[var(--secondary-container)]"
                />
            </div>
            <div className="flex items-center gap-4">
                {/* Room Section */}
                {currentRoom ? (
                    <div className="flex items-center gap-2 bg-[var(--nav-bg)] border border-[var(--outline-variant)] px-3 py-1.5 rounded-md">
                        <span className="text-[11px] text-[var(--outline)] font-semibold uppercase tracking-wider hidden sm:inline font-mono">Room</span>
                        {isEditingRoom ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    autoFocus
                                    className="text-sm bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] outline-none rounded px-1.5 py-0.5 w-24 text-[var(--on-surface)] focus:border-[var(--secondary-container)] font-mono"
                                    value={editRoomInput}
                                    onChange={(e) => setEditRoomInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom()}
                                />
                                <button onClick={handleRenameRoom} className="text-[var(--on-surface)] hover:text-[var(--secondary-container)] cursor-pointer p-0.5 rounded hover:bg-white/5">
                                    <Check size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--on-surface)] font-mono">{currentRoom}</span>
                                <button onClick={() => { setEditRoomInput(currentRoom); setIsEditingRoom(true); }} className="text-[var(--outline)] hover:text-[var(--primary)] cursor-pointer transition-colors">
                                    <Pencil size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Room ID"
                            className="text-sm bg-[var(--nav-bg)] border border-[var(--outline-variant)] outline-none rounded px-2.5 py-1.5 w-28 focus:border-[var(--secondary-container)] focus:ring-1 focus:ring-[var(--secondary-container)] transition-colors text-[var(--on-surface)] font-mono placeholder-[var(--outline)]"
                            value={joinInput}
                            onChange={(e) => setJoinInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                        />
                        <button onClick={handleJoinRoom} className="text-sm bg-[var(--primary-container)] text-[var(--on-primary-container)] px-3 py-1.5 rounded hover:bg-[var(--primary)] transition-colors font-bold">Join</button>
                    </div>
                )}

                <div className="h-6 w-px bg-[var(--outline-variant)] mx-1 hidden sm:block"></div>

                {/* Download Button */}
                {onDownload && currentRoom && (
                    <button onClick={onDownload} className="text-[var(--outline)] hover:text-[var(--primary)] transition-colors p-1.5 rounded hover:bg-[var(--surface-container-high)]" title="Download as Word">
                        <Download size={18} />
                    </button>
                )}

                {/* Info Button */}
                <button onClick={() => setIsInfoOpen(true)} className="text-[var(--outline)] hover:text-[var(--primary)] transition-colors p-1.5 rounded hover:bg-[var(--surface-container-high)]" title="How to use">
                    <Info size={18} />
                </button>

                {/* Theme Toggle */}
                <button onClick={toggleTheme} className="text-[var(--outline)] hover:text-[var(--primary)] transition-colors p-1.5 rounded hover:bg-[var(--surface-container-high)]" title="Toggle Theme">
                    {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
                </button>

                <div className="h-6 w-px bg-[var(--outline-variant)] mx-1 hidden sm:block"></div>

                {/* Profile & Logout */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] bg-[var(--surface-container-high)] flex items-center justify-center text-xs text-[var(--on-surface)] font-bold uppercase shadow-[0_0_5px_var(--primary)]">
                        {username.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[var(--on-surface)] hidden sm:inline">{username}</span>
                </div>
                <button
                    onClick={() => {
                        removeCookie("token", { path: "/" });
                        navigate("/login");
                        toast.info("Logged out");
                    }}
                    className="text-sm text-[var(--outline)] hover:text-[var(--danger)] transition-colors font-medium"
                >
                    Log out
                </button>
            </div>
            </header>

            {/* Info Modal */}
            {isInfoOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--surface-container-high)] border border-[var(--outline-variant)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                            <h2 className="text-lg font-bold text-[var(--on-surface)] flex items-center gap-2">
                                <Info size={20} className="text-[var(--primary)]" />
                                How to use Collab Write
                            </h2>
                            <button onClick={() => setIsInfoOpen(false)} className="text-[var(--outline)] hover:text-[var(--danger)] transition-colors p-1 rounded-md hover:bg-black/10">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5 text-[15px] text-[var(--on-surface-variant)] leading-relaxed">
                            <p>Welcome to <strong>Collab Write</strong>, a real-time collaborative document editor.</p>
                            
                            <div className="flex flex-col gap-3">
                                <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--outline-variant)]">
                                    <h3 className="font-semibold text-[var(--on-surface)] mb-1">Rooms & Joining</h3>
                                    <p className="text-sm">Create or join a room using the input in the navbar. Anyone in the same room will see your edits instantly.</p>
                                </div>
                                
                                <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--outline-variant)]">
                                    <h3 className="font-semibold text-[var(--on-surface)] mb-1">Live Collaboration</h3>
                                    <p className="text-sm">Type directly in the editor. Your changes are perfectly synced to all users using operational transforms (Delta).</p>
                                </div>
                                
                                <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--outline-variant)]">
                                    <h3 className="font-semibold text-[var(--on-surface)] mb-1">Chat & Logs</h3>
                                    <p className="text-sm">Use the sidebar to send messages to other collaborators and track when users join or leave the room.</p>
                                </div>
                                
                                <div className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--outline-variant)]">
                                    <h3 className="font-semibold text-[var(--on-surface)] mb-1">Auto-Save</h3>
                                    <p className="text-sm">Documents are automatically securely saved to the database after 2 seconds of inactivity.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
