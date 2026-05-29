import React, { useState, useEffect } from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { CU } from '@/components/worldcup/wcTokens';
import FixturesTab from '@/components/worldcup/FixturesTab';
import ResultsTab from '@/components/worldcup/ResultsTab';
import StandingsTab from '@/components/worldcup/StandingsTab';

const TABS = [
    { key: 'fixtures', label: 'Fixtures' },
    { key: 'results', label: 'Results' },
    { key: 'standings', label: 'Standings' },
    { key: 'news', label: 'News' },
];

/* ── Google Fonts loader ─────────────────────────────────── */
function FontLoader() {
    useEffect(() => {
        if (!document.getElementById('cu-fonts')) {
            const link = document.createElement('link');
            link.id = 'cu-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Raleway:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
    }, []);
    return null;
}

export default function WorldCup() {
    const [activeTab, setActiveTab] = useState('fixtures');

    return (
        <>
            <FontLoader />
            <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-16" style={{ fontFamily: "'Raleway', sans-serif" }}>
                <WorldCupBanner compact />

                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.orange }}>
                            <span className="text-xl">🌍</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            World Cup
                        </h1>
                    </div>
                    <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
                        Fixtures, results, standings & news from FIFA World Cup 2026.
                    </p>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    background: isActive ? 'white' : 'transparent',
                                    color: isActive ? CU.charcoal : '#9ca3af',
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab content */}
                {activeTab === 'fixtures' && <FixturesTab />}
                {activeTab === 'results' && <ResultsTab />}
                {activeTab === 'standings' && <StandingsTab />}
                {activeTab !== 'fixtures' && activeTab !== 'results' && activeTab !== 'standings' && (
                    <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                        Coming soon!
                    </div>
                )}
            </div>
        </>
    );
}