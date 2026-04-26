import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCookies } from "react-cookie";
import { toast } from "react-toastify";
import { Pencil, Check } from "lucide-react";

interface NavbarProps {
    username: string;
    socketId: string;
    socket: any;
    currentRoom: string;
    setCurrentRoom: (room: string) => void;
    docTitle?: string;
    setDocTitle?: (title: string) => void;
}

const Navbar = ({ username, socketId, socket, currentRoom, setCurrentRoom, docTitle, setDocTitle }: NavbarProps) => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);

    const [joinInput, setJoinInput] = useState("");
    const [isEditingRoom, setIsEditingRoom] = useState(false);
    const [editRoomInput, setEditRoomInput] = useState("");

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
                    <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[var(--outline-variant)] px-3 py-1.5 rounded-md">
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
                            className="text-sm bg-[#0a0a0a] border border-[var(--outline-variant)] outline-none rounded px-2.5 py-1.5 w-28 focus:border-[var(--secondary-container)] focus:ring-1 focus:ring-[var(--secondary-container)] transition-colors text-[var(--on-surface)] font-mono placeholder-[var(--outline)]"
                            value={joinInput}
                            onChange={(e) => setJoinInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                        />
                        <button onClick={handleJoinRoom} className="text-sm bg-[var(--primary-container)] text-[var(--on-primary-container)] px-3 py-1.5 rounded hover:bg-[var(--primary)] transition-colors font-bold">Join</button>
                    </div>
                )}

                {/* Socket ID */}
                {socketId && (
                    <div className="flex items-center gap-1.5 hidden lg:flex bg-[#0a0a0a] border border-[var(--outline-variant)] px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--secondary-container)] animate-pulse shadow-[0_0_5px_var(--secondary-container)]"></span>
                        <span className="text-[11px] text-[var(--on-surface-variant)] font-mono tracking-tight">ID: {socketId}</span>
                    </div>
                )}

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
                    className="text-sm text-[var(--outline)] hover:text-[#ffb4ab] transition-colors font-medium"
                >
                    Log out
                </button>
            </div>
        </header>
    );
};

export default Navbar;
