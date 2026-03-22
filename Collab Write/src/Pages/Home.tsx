import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import axios from "axios";
import { toast } from "react-toastify";
import Edit from "../Components/Edit.tsx";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const Home = () => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);
    const [isVerified, setIsVerified] = useState(false);
    const [username, setUsername] = useState("");
    const [socketId, setSocketId] = useState("");

    useEffect(() => {
        if (socket.connected) {
            setSocketId(socket.id || "");
        }
        socket.on("connect", () => {
            setSocketId(socket.id || "");
        });

        return () => {
            socket.off("connect");
        };
    }, []);

    useEffect(() => {
        const verifyCookie = async () => {
            if (!cookies.token) {
                navigate("/login");
                return;
            }
            try {
                const { data } = await axios.post(
                    "http://localhost:3000/",
                    {},
                    { withCredentials: true }
                );
                const { status, user } = data;
                if (status) {
                    setIsVerified(true);
                    setUsername(user);
                    toast.success(`Welcome ${user}!`, { toastId: "welcome", autoClose: 2500 });
                } else {
                    removeCookie("token", { path: "/" });
                    navigate("/login");
                }
            } catch (error) {
                removeCookie("token", { path: "/" });
                navigate("/login");
            }
        };

        verifyCookie();
    }, [cookies.token, navigate, removeCookie]);

    if (!isVerified) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-pulse bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-slate-500 font-medium">Verifying secure session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <header className="px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                        Q
                    </div>
                    <div>
                        <div className="flex flex-col">
                            <input
                                type="text"
                                defaultValue="Untitled Document"
                                className="text-lg font-semibold text-slate-800 leading-tight bg-transparent border-none outline-none focus:ring-0 p-0 w-40 sm:w-64 hover:bg-slate-100 focus:bg-slate-100 rounded px-1 -ml-1 transition-colors"
                            />
                            <p className="text-xs text-slate-500 font-medium px-1">Saved to Cloud • Last edited just now</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4 text-sm font-medium text-slate-600">
                    <div className="bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                        <span>{username}</span>
                    </div>
                    {socketId && (
                        <div className="hidden sm:block bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm font-mono text-xs">
                            ID: {socketId}
                        </div>
                    )}
                </div>
            </header>

            <Edit />

            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => {
                        removeCookie("token", { path: "/" });
                        navigate("/login");
                        toast.info("Logged out successfully");
                    }}
                    className="px-4 py-2 bg-rose-50 text-rose-600 font-medium text-sm rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-50"
                >
                    Log Out
                </button>
            </div>
        </div>
    );
};

export default Home;
