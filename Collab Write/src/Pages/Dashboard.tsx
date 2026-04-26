import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import axios from "axios";
import { toast } from "react-toastify";

interface Document {
    _id: string;
    title: string;
    updatedAt: string;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(["token"]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyCookieAndFetchData = async () => {
            if (!cookies.token) {
                navigate("/login");
                return;
            }
            try {
                // Verify Auth
                const authRes = await axios.post("http://localhost:3000/", {}, { withCredentials: true });
                if (authRes.data.status) {
                    setUsername(authRes.data.user);
                    // Fetch Documents
                    const docRes = await axios.get("http://localhost:3000/documents/list", { withCredentials: true });
                    if (docRes.data.status) {
                        setDocuments(docRes.data.documents);
                    }
                } else {
                    removeCookie("token", { path: "/" });
                    navigate("/login");
                }
            } catch (err) {
                console.error(err);
                removeCookie("token", { path: "/" });
                navigate("/login");
            } finally {
                setLoading(false);
            }
        };
        verifyCookieAndFetchData();
    }, [cookies.token, navigate, removeCookie]);

    const createDocument = async () => {
        try {
            const res = await axios.post("http://localhost:3000/documents/create", {}, { withCredentials: true });
            if (res.data.status) {
                navigate(`/edit/${res.data.document._id}`);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to create document");
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-[#999]">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#f7f7f7] flex flex-col">
            <header className="bg-white border-b border-[#e5e5e5] px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-[#333]">My Documents</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-[#666]">Hello, {username}</span>
                    <button
                        onClick={() => {
                            removeCookie("token", { path: "/" });
                            navigate("/login");
                        }}
                        className="text-sm text-red-500 hover:text-red-700"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="p-8 max-w-6xl mx-auto w-full">
                <div className="mb-8">
                    <button
                        onClick={createDocument}
                        className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
                    >
                        + New Document
                    </button>
                </div>

                {documents.length === 0 ? (
                    <div className="text-center py-20 text-[#999] bg-white border border-[#e5e5e5] rounded-md">
                        <p>No documents found. Create one to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {documents.map((doc) => (
                            <div
                                key={doc._id}
                                onClick={() => navigate(`/edit/${doc._id}`)}
                                className="bg-white border border-[#e5e5e5] p-5 rounded-md hover:shadow-md cursor-pointer transition-all flex flex-col justify-between aspect-[3/4]"
                            >
                                <h3 className="font-medium text-lg text-[#333] mb-2 truncate" title={doc.title}>
                                    {doc.title}
                                </h3>
                                <p className="text-xs text-[#999]">
                                    Last updated: {new Date(doc.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
