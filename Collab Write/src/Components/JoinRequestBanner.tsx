import React from "react";

interface JoinRequestBannerProps {
    pendingRequest: { requesterId: string; username: string } | null;
    onRespond: (approved: boolean) => void;
}

const JoinRequestBanner: React.FC<JoinRequestBannerProps> = ({ pendingRequest, onRespond }) => {
    if (!pendingRequest) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-container-high)] border border-[var(--outline-variant)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 w-80 animate-in slide-in-from-bottom-4 fade-in">
            <p className="text-sm font-semibold text-[var(--on-surface)] mb-1">Join Request</p>
            <p className="text-sm text-[var(--on-surface-variant)] mb-3">
                <span className="font-bold text-[var(--primary)]">{pendingRequest.username}</span> wants to join this document.
            </p>
            <div className="flex gap-2">
                <button
                    onClick={() => onRespond(true)}
                    className="flex-1 py-2 bg-[var(--primary)] text-[var(--on-primary)] rounded-md text-sm font-bold hover:shadow-[0_0_10px_var(--primary)] transition-all"
                >
                    Approve
                </button>
                <button
                    onClick={() => onRespond(false)}
                    className="flex-1 py-2 bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] rounded-md text-sm font-bold hover:text-[var(--danger)] transition-colors"
                >
                    Deny
                </button>
            </div>
        </div>
    );
};

export default JoinRequestBanner;
