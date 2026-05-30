import React from 'react';

const Pulse = ({ className, style }) => (
    <div className={`animate-pulse rounded ${className || ''}`} style={{ background: '#e5e7eb', ...style }} />
);

export function StatCardSkeleton() {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: '#e5e7eb' }} />
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <Pulse className="w-9 h-9" style={{ borderRadius: '8px' }} />
                    <div className="flex-1 space-y-2">
                        <Pulse className="h-6 w-16" />
                        <Pulse className="h-3 w-20" />
                        <Pulse className="h-2.5 w-14" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function NextMatchSkeleton() {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: '#e5e7eb' }} />
            <div className="p-5 space-y-4">
                <Pulse className="h-4 w-44" />
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                        <Pulse className="w-10 h-10 rounded-full" />
                        <Pulse className="h-3 w-16" />
                    </div>
                    <Pulse className="h-3 w-6" />
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                        <Pulse className="w-10 h-10 rounded-full" />
                        <Pulse className="h-3 w-16" />
                    </div>
                </div>
                <Pulse className="h-3 w-40 mx-auto" />
                <Pulse className="h-10 w-full rounded-lg" />
            </div>
        </div>
    );
}