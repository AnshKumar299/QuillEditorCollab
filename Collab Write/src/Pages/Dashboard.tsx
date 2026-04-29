import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../Context/ToastContext";
import { Sun, Moon } from "lucide-react";

interface Document {
    _id: string;
    title: string;
    updatedAt: string;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
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
                // Verify Auth
                const authRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/`, {}, { withCredentials: true });
                if (authRes.data.status) {
                    setUsername(authRes.data.user);
                    // Fetch Documents
                    const docRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/documents/list`, { withCredentials: true });
                    if (docRes.data.status) {
                        setDocuments(docRes.data.documents);
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

    if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading...</div>;

    return (
        <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col">
            <header className="bg-[var(--surface-container-low)]/80 backdrop-blur-md border-b border-[var(--outline-variant)] px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-[var(--primary)] tracking-tight">Collab Write</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-[var(--on-surface-variant)] hidden sm:inline">{username}</span>
                    <button onClick={toggleTheme} className="text-[var(--outline)] hover:text-[var(--primary)] transition-colors p-1.5 rounded hover:bg-[var(--surface-container-high)]" title="Toggle Theme">
                        {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem("isLoggedIn");
                            navigate("/login");
                        }}
                        className="text-sm font-semibold text-[var(--danger)] hover:text-[var(--danger-hover)] transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="p-8 lg:p-12 max-w-7xl mx-auto w-full">
                <div className="mb-10">
                    <h2 className="text-xl font-bold text-[var(--primary)] tracking-tight">My documents</h2>
                    <br />
                    <button
                        onClick={createDocument}
                        className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] px-6 py-3 font-bold rounded-md hover:shadow-[0_0_15px_var(--primary)] transition-all"
                    >
                        + New Document
                    </button>
                </div>

                {documents.length === 0 ? (
                    <div className="text-center py-24 text-[var(--on-surface-variant)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                        <p className="text-lg">No documents found. Create one to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {documents.map((doc) => (
                            <div
                                key={doc._id}
                                onClick={() => navigate(`/edit/${doc._id}`)}
                                className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl hover:bg-white/10 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer transition-all flex flex-col justify-between aspect-[3/4] group"
                            >
                                <h3 className="font-bold text-xl text-[var(--on-surface)] mb-2 truncate group-hover:text-[var(--primary)] transition-colors" title={doc.title}>
                                    {doc.title}
                                </h3>
                                <div className="flex items-center justify-between mt-auto">
                                    <p className="text-xs font-mono text-[var(--on-surface-variant)]">
                                        {new Date(doc.updatedAt).toLocaleDateString()}
                                    </p>
                                    <div className="w-8 h-8 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] group-hover:text-[var(--primary)] group-hover:bg-[var(--surface-container-lowest)] transition-all">
                                        →
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
