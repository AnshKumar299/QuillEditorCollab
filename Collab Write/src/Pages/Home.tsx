import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCookies } from "react-cookie";
import axios from "axios";
import { toast } from "react-toastify";
import Edit from "../Components/Edit.tsx";
import Navbar from "../Components/Navbar.tsx";
import LogsSidebar from "../Components/LogsSidebar.tsx";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { autoConnect: false });

const Home = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);
    const [isVerified, setIsVerified] = useState(false);
    const [username, setUsername] = useState("");
    const usernameRef = useRef("");
    useEffect(() => { usernameRef.current = username; }, [username]);
    const [currentRoom, setCurrentRoom] = useState("");
    const [socketId, setSocketId] = useState("");
    const [delta, setDelta] = useState({});
    const [docTitle, setDocTitle] = useState("Untitled");
    const quillRef = useRef<any>(null);
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        setLogs([]);
        setDelta({});
    }, [currentRoom]);

    useEffect(() => {
        socket.connect();
        if (socket.connected) setSocketId(socket.id || "");
        socket.on("connect", () => setSocketId(socket.id || ""));
        
        // Initial load
        socket.on("load-document", (data) => {
            if (data.content) setDelta(data.content);
            if (data.title) setDocTitle(data.title);
        });

        // Receive changes from other users
        socket.on("receive-delta", (deltaChange) => {
            if (quillRef.current) {
                quillRef.current.getEditor().updateContents(deltaChange);
            }
        });

        socket.on("document-renamed", (user, newTitle) => {
            setDocTitle(newTitle);
            setLogs((prev) => [...prev, { type: 'log', text: `${user} renamed the file to "${newTitle}"` }]);
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
        
        return () => {
            socket.off("connect");
            socket.off("load-document");
            socket.off("receive-delta");
            socket.off("document-renamed");
            socket.off("user-joined");
            socket.off("user-left");
            socket.off("receive-chat-message");
            socket.disconnect();
        };
    }, []);

    // Join doc room to load data initially
    useEffect(() => {
        if (username && id) {
            socket.emit("join-room", id, username);
            setCurrentRoom(id);
        }
    }, [username, id]);

    useEffect(() => {
        const verifyCookie = async () => {
            if (!cookies.token) { navigate("/login"); return; }
            try {
                const { data } = await axios.post("http://localhost:3000/", {}, { withCredentials: true });
                const { status, user } = data;
                if (status) {
                    setIsVerified(true);
                    setUsername(user);
                    toast.success(`Welcome back, ${user}`, { toastId: "welcome", autoClose: 2500 });
                } else { removeCookie("token", { path: "/" }); navigate("/login"); }
            } catch { removeCookie("token", { path: "/" }); navigate("/login"); }
        };
        verifyCookie();
    }, [cookies.token, navigate, removeCookie]);

    if (!isVerified) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-sm text-[#999]">Loading...</p>
            </div>
        );
    }

    const handleSendMessage = (msg: string) => {
        const room = currentRoom || id;
        if (!room || !msg.trim()) return;
        socket.emit("chat-message", room, username, msg);
        setLogs((prev) => [...prev, { type: 'message', user: username, text: msg }]);
    };

    return (
        <div className="min-h-screen flex flex-col bg-[var(--surface)] text-[var(--on-surface)]">
            <Navbar 
                username={username} 
                socketId={socketId} 
                socket={socket} 
                currentRoom={currentRoom} 
                setCurrentRoom={setCurrentRoom} 
                docTitle={docTitle}
                setDocTitle={setDocTitle}
            />
            <main className="flex-1 flex bg-[var(--surface)] overflow-hidden relative bg-gradient-to-br from-[#131313] to-[#1a1a2e]/20">
                {/* Editor Container */}
                <div className="flex-1 flex justify-center p-4 sm:p-8 overflow-y-auto relative">
                    <div className="w-full max-w-5xl bg-[var(--surface-container-low)]/80 backdrop-blur-md border border-[var(--outline-variant)] rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-h-full relative overflow-hidden">
                        <Edit delta={delta} setDelta={setDelta} socket={socket} quillRef={quillRef} currentRoom={currentRoom} />
                    </div>
                </div>

                {/* Sidebar Container */}
                <div className="w-80 flex flex-col z-10 hidden md:flex shrink-0">
                    <LogsSidebar logs={logs} currentRoom={currentRoom} onSendMessage={handleSendMessage} />
                </div>
            </main>

            <button className="fixed bottom-4 left-4 bg-[var(--surface-container-high)] border border-[var(--outline-variant)] px-2 py-1 text-xs font-mono rounded-md text-[var(--on-surface-variant)] opacity-20 hover:opacity-100 transition-opacity z-50" onClick={() => {
                console.log(quillRef.current?.getEditor().getContents());
            }}>Debug: Get Delta</button>
        </div>
    );
};

export default Home;
