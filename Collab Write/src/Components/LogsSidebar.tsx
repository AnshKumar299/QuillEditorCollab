import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface LogEntry {
    type: 'log' | 'message';
    user?: string;
    text: string;
}

interface LogsSidebarProps {
    logs: LogEntry[];
    currentRoom: string;
    onSendMessage: (msg: string) => void;
}

const LogsSidebar: React.FC<LogsSidebarProps> = ({ logs, currentRoom, onSendMessage }) => {
    const endOfLogsRef = useRef<HTMLDivElement>(null);
    const [inputMsg, setInputMsg] = useState("");

    useEffect(() => {
        // Scroll to the bottom whenever new logs are added
        endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleSend = () => {
        if (!inputMsg.trim()) return;
        onSendMessage(inputMsg);
        setInputMsg("");
    };

    return (
        <div className="flex flex-col h-full bg-[#fafafa]">
            <div className="px-4 py-3 border-b border-[#e5e5e5] bg-white shrink-0 shadow-sm z-10">
                <h3 className="text-sm font-semibold text-[#111]">Activity Logs</h3>
            </div>
            
            <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
                <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar h-full">
                    {!currentRoom ? (
                        <div className="text-[#999] text-xs text-center my-auto">No room joined</div>
                    ) : logs.length === 0 ? (
                        <div className="text-[#999] text-xs text-center my-auto">No activity yet</div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className="w-full text-[13px] break-words animate-in fade-in slide-in-from-bottom-2">
                                {log.type === 'log' ? (
                                    <div className="text-[#666] text-center text-xs my-2 italic">{log.text}</div>
                                ) : (
                                    <div className="text-[#111] mb-1">
                                        <span className="font-semibold text-[#000080]">{log.user}</span>
                                        <span className="mx-1">:</span>
                                        <span>{log.text}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={endOfLogsRef} />
                </div>
            </div>

            {/* Message Input Section */}
            <div className="p-3 bg-white border-t border-[#e5e5e5]">
                <div className={`flex items-center bg-[#f5f5f5] rounded-full px-3 py-1.5 border border-[#e5e5e5] transition-colors ${currentRoom ? 'focus-within:border-[#ccc]' : 'opacity-50'}`}>
                    <input 
                        type="text" 
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={currentRoom ? "Type a message..." : "Join a room to chat"}
                        disabled={!currentRoom}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-[#333] px-2"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!currentRoom}
                        className={`p-1.5 text-[#666] transition-colors rounded-full flex-shrink-0 ${currentRoom ? 'hover:text-[#111] hover:bg-[#e5e5e5]' : ''}`}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogsSidebar;
