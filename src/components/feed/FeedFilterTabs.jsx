import React from 'react';
import { CU } from './feedConstants';

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'popular', label: 'Popular' },
    { key: 'following', label: 'Following' },
];

export default function FeedFilterTabs({ active, onChange }) {
    return (
        <div className="flex items-center gap-1 p-1 rounded-xl mb-5" style={{ background: CU.charcoal }}>
            {TABS.map(tab => {
                const isActive = active === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className="flex-1 py-2 rounded-lg text-sm transition-colors"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            fontWeight: 600,
                            background: isActive ? CU.orange : 'transparent',
                            color: isActive ? CU.charcoal : 'rgba(255,255,255,0.7)',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}