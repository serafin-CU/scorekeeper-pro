import React from 'react';

/* ── Animated grey pulse placeholders for Dashboard loading ── */

function Bar({ w = '100%', h = '14px', className = '' }) {
    return (
        <div
            className={`animate-pulse rounded ${className}`}
            style={{ width: w, height: h, background: '#e5e7eb' }}
        />
    );
}

export function StatCardSkeleton() {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: '#e5e7eb' }} />
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="animate-pulse rounded-lg" style={{ width: '37px', height: '37px', background: '#e5e7eb' }} />
                    <div className="flex-1 space-y-2 pt-1">
                        <Bar w="50%" h="20px" />
                        <Bar w="70%" h="12px" />
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
                <Bar w="40%" h="14px" />
                <div className="flex items-center justify-center gap-4">
                    <div className="animate-pulse rounded-full" style={{ width: '48px', height: '48px', background: '#e5e7eb' }} />
                    <Bar w="40px" h="20px" />
                    <div className="animate-pulse rounded-full" style={{ width: '48px', height: '48px', background: '#e5e7eb' }} />
                </div>
                <Bar w="100%" h="36px" />
            </div>
        </div>
    );
}