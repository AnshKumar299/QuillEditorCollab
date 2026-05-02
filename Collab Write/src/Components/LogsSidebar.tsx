import React, { useState, useEffect, useRef } from "react";
import { Send, ChevronDown, ChevronUp, Wifi, Users } from "lucide-react";

interface LogEntry {
    type: 'log' | 'message';
    user?: string;
    text: string;
}

interface LogsSidebarProps {
    logs: LogEntry[];
    currentRoom: string;
    onSendMessage: (msg: string) => void;
    activeUsers?: string[];
    allUsers?: string[];
}

const UserPanel = ({
    label,
    icon,
    users,
    accentClass,
    dotClass,
}: {
    label: string;
    icon: React.ReactNode;
    users: string[];
    accentClass: string;
    dotClass: string;
}) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="border border-[var(--outline-variant)] rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className={accentClass}>{icon}</span>
                    <span className="text-xs font-semibold text-[var(--on-surface)] tracking-wide">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${accentClass} bg-[var(--surface-container-low)]`}>
                        {users.length}
                    </span>
                    {open
                        ? <ChevronUp size={13} className="text-[var(--outline)]" />
                        : <ChevronDown size={13} className="text-[var(--outline)]" />}
                </div>
            </button>

            {open && (
                <div className="px-3 py-2 flex flex-col gap-1.5 bg-[var(--surface-container-low)] max-h-40 overflow-y-auto">
                    {users.length === 0 ? (
                        <p className="text-xs text-[var(--outline)] italic text-center py-1">No users</p>
                    ) : (
                        users.map((u, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                                <span className="text-xs text-[var(--on-surface-variant)] font-mono truncate">{u}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const LogsSidebar: React.FC<LogsSidebarProps> = ({ logs, currentRoom, onSendMessage, activeUsers = [], allUsers = [] }) => {
    const endOfLogsRef = useRef<HTMLDivElement>(null);
    const [inputMsg, setInputMsg] = useState("");

    useEffect(() => {
        endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleSend = () => {
        if (!inputMsg.trim()) return;
        onSendMessage(inputMsg);
        setInputMsg("");
    };

    return (
        <div className="flex flex-col h-full bg-[var(--surface-container-low)] text-[var(--on-surface)] border-l border-[var(--outline-variant)]">
            <div className="px-4 py-3 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]/80 backdrop-blur-md shrink-0 shadow-sm z-10">
                <h3 className="text-sm font-bold text-[var(--primary)] tracking-tight">Activity Log</h3>
            </div>

            {/* ── User Panels ─────────────────────────────────────────────────── */}
            <div className="px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-[var(--outline-variant)] shrink-0">
                <UserPanel
                    label="Active Now"
                    icon={<Wifi size={13} />}
                    users={activeUsers}
                    accentClass="text-emerald-400"
                    dotClass="bg-emerald-400"
                />
                <UserPanel
                    label="All Users"
                    icon={<Users size={13} />}
                    users={allUsers}
                    accentClass="text-[var(--primary)]"
                    dotClass="bg-[var(--primary)]"
                />
            </div>

            {/* ── Log Messages ────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
                <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar h-full">
                    {!currentRoom ? (
                        <div className="text-[var(--outline)] font-mono text-xs text-center my-auto">No room joined</div>
                    ) : logs.length === 0 ? (
                        <div className="text-[var(--outline)] font-mono text-xs text-center my-auto">No activity yet</div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className="w-full text-[13px] break-words animate-in fade-in slide-in-from-bottom-2">
                                {log.type === 'log' ? (
                                    <div className="text-[var(--on-surface-variant)] text-center font-mono text-xs my-2 italic">{log.text}</div>
                                ) : (
                                    <div className="text-[var(--on-surface)] mb-1">
                                        <span className="font-bold text-[var(--primary)]">{log.user}</span>
                                        <span className="mx-1 text-[var(--outline-variant)]">:</span>
                                        <span>{log.text}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={endOfLogsRef} />
                </div>
            </div>

            {/* ── Message Input ────────────────────────────────────────────────── */}
            <div className="p-3 bg-[var(--surface-container-low)] border-t border-[var(--outline-variant)]">
                <div className={`flex items-center bg-[var(--nav-bg)] rounded-full px-3 py-1.5 border border-[var(--outline-variant)] transition-colors ${currentRoom ? 'focus-within:border-[var(--secondary-container)] focus-within:ring-1 focus-within:ring-[var(--secondary-container)]' : 'opacity-50'}`}>
                    <input
                        type="text"
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={currentRoom ? "Type a message..." : "Join a room to chat"}
                        disabled={!currentRoom}
                        className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[var(--on-surface)] placeholder-[var(--outline)] px-2"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!currentRoom}
                        className={`p-1.5 text-[var(--on-surface-variant)] transition-colors rounded-full flex-shrink-0 ${currentRoom ? 'hover:text-[var(--secondary-container)]' : ''}`}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogsSidebar;
