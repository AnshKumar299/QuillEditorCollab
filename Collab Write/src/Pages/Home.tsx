import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import axios from "axios";
import { toast } from "react-toastify";
import Edit from "../Components/Edit.tsx";
import Navbar from "../Components/Navbar.tsx";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { autoConnect: false });

const Home = () => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);
    const [isVerified, setIsVerified] = useState(false);
    const [username, setUsername] = useState("");
    const [currentRoom, setCurrentRoom] = useState("");
    const [socketId, setSocketId] = useState("");
    const [delta, setDelta] = useState({});
    const quillRef = useRef(null);

    useEffect(() => {
        socket.connect();
        if (socket.connected) setSocketId(socket.id || "");
        socket.on("connect", () => setSocketId(socket.id || ""));
        socket.on("message", (data) => setDelta(data));
        socket.on("room-renamed", (newId) => {
            setCurrentRoom(newId);
            socket.emit("join-room", newId);
            toast.info(`Room renamed to ${newId}`);
        });
        return () => {
            socket.off("connect");
            socket.off("message");
            socket.off("room-renamed");
            socket.disconnect();
        };
    }, []);

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

    return (
        <div className="min-h-screen flex flex-col bg-white">
            <Navbar username={username} socketId={socketId} socket={socket} currentRoom={currentRoom} setCurrentRoom={setCurrentRoom} />
            {/* Editor — full width landscape layout */}
            <main className="flex-1 flex justify-center bg-[#f7f7f7] p-4 sm:p-6">
                <div className="w-full max-w-6xl bg-white border border-[#e5e5e5] rounded-md flex flex-col shadow-sm">
                    <Edit delta={delta} setDelta={setDelta} socket={socket} quillRef={quillRef} />
                </div>
            </main>

            <button onClick={() => {
                console.log(quillRef.current?.getEditor().getContents());
            }}>Get Delta</button>
        </div>
    );
};

export default Home;
