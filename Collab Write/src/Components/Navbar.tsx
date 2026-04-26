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
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#e5e5e5] bg-white shrink-0">
            <div className="flex items-center gap-4">
                <Link to="/" className="text-lg font-bold text-[#111] tracking-tight hover:text-[#555] transition-colors">
                    Collab Write
                </Link>
                <span className="text-[#ccc] text-lg font-light">/</span>
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
                    className="text-base text-[#333] bg-transparent border-none outline-none px-2 py-1 rounded hover:bg-[#f5f5f5] focus:bg-[#f5f5f5] w-32 sm:w-64 transition-colors font-medium"
                />
            </div>
            <div className="flex items-center gap-4">
                {/* Room Section */}
                {currentRoom ? (
                    <div className="flex items-center gap-2 bg-[#f5f5f5] px-3 py-1.5 rounded-md">
                        <span className="text-[11px] text-[#888] font-semibold uppercase tracking-wider hidden sm:inline">Room</span>
                        {isEditingRoom ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    autoFocus
                                    className="text-sm bg-white border border-[#ccc] outline-none rounded px-1.5 py-0.5 w-24 text-[#333] focus:border-[#888]"
                                    value={editRoomInput}
                                    onChange={(e) => setEditRoomInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom()}
                                />
                                <button onClick={handleRenameRoom} className="text-[#111] hover:text-[#000] cursor-pointer p-0.5 rounded hover:bg-[#e5e5e5]">
                                    <Check size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#111]">{currentRoom}</span>
                                <button onClick={() => { setEditRoomInput(currentRoom); setIsEditingRoom(true); }} className="text-[#aaa] hover:text-[#111] cursor-pointer transition-colors">
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
                            className="text-sm bg-[#f9f9f9] border border-[#e5e5e5] outline-none rounded px-2.5 py-1.5 w-28 focus:border-[#ccc] transition-colors"
                            value={joinInput}
                            onChange={(e) => setJoinInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                        />
                        <button onClick={handleJoinRoom} className="text-sm bg-[#111] text-white px-3 py-1.5 rounded hover:bg-[#333] transition-colors font-medium">Join</button>
                    </div>
                )}

                {/* Socket ID */}
                {socketId && (
                    <div className="flex items-center gap-1.5 hidden lg:flex bg-[#f9f9f9] border border-[#e5e5e5] px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span className="text-[11px] text-[#666] font-mono tracking-tight">ID: {socketId}</span>
                    </div>
                )}

                <div className="h-6 w-px bg-[#e5e5e5] mx-1 hidden sm:block"></div>

                {/* Profile & Logout */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center text-xs text-white font-semibold uppercase">
                        {username.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[#333] hidden sm:inline">{username}</span>
                </div>
                <button
                    onClick={() => {
                        removeCookie("token", { path: "/" });
                        navigate("/login");
                        toast.info("Logged out");
                    }}
                    className="text-sm text-[#aaa] hover:text-[#111] transition-colors"
                >
                    Log out
                </button>
            </div>
        </header>
    );
};

export default Navbar;
