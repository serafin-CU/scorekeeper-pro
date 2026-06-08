import React, { useState } from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Loader2, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    sand: '#C7B273',
};

function RankBadge({ rank }) {
    if (rank === 1) return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
             style={{ background: CU.orange, color: 'white', fontFamily: "'DM Serif Display', serif" }}>1</div>
    );
    if (rank === 2) return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
             style={{ background: CU.sand, color: 'white', fontFamily: "'DM Serif Display', serif" }}>2</div>
    );
    if (rank === 3) return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
             style={{ background: CU.magenta, color: 'white', fontFamily: "'DM Serif Display', serif" }}>3</div>
    );
    return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
             style={{ background: '#f3f4f6', color: '#6b7280', fontFamily: "'Raleway', sans-serif" }}>{rank}</div>
    );
}

function LeaderboardTable({ entries, currentUserId, mode }) {
    if (entries.length === 0) {
        return (
            <div className="text-center py-12" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                No scores recorded yet for {mode === 'ALL' ? 'any mode' : mode}.
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {entries.map((entry, i) => {
                const rank = i + 1;
                const isMe = entry.user_id === currentUserId;
                return (
                    <div
                        key={entry.user_id}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
                        style={{
                            background: isMe ? CU.orange + '18' : rank <= 3 ? '#f9fafb' : 'white',
                            border: isMe ? `1px solid ${CU.orange}50` : '1px solid transparent',
                        }}
                    >
                        <RankBadge rank={rank} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{
                                fontFamily: "'Raleway', sans-serif",
                                fontWeight: 600,
                                color: isMe ? CU.charcoal : CU.charcoal
                            }}>
                                {rank === 1 && <span className="mr-1">🏆</span>}
                                {isMe
                                ? <Link to="/Profile" style={{ color: 'inherit', textDecoration: 'none' }}>{entry.display_name || (entry.email ? entry.email.split('@')[0] : entry.user_id.slice(-8))}</Link>
                                : <span>{entry.display_name || (entry.email ? entry.email.split('@')[0] : entry.user_id.slice(-8))}</span>
                            }
                                {isMe && (
                                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                                          style={{ background: CU.orange + '30', color: CU.charcoal, fontWeight: 700 }}>
                                        you
                                    </span>
                                )}
                            </div>
                        </div>
                        {mode === 'ALL' && (
                            <div className="flex gap-3 text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                <span title="Prode">P: {entry.prode_points}</span>
                            </div>
                        )}
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', color: CU.charcoal }}>
                            {entry.total_points}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const TAB_CONFIG_BASE = [
    { value: 'PRODE', label: 'Prode', icon: Medal },
    { value: 'TRIVIA', label: 'Trivia', icon: Brain },
];

export default function Leaderboard() {
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [tab, setTab] = useState(tabParam === 'trivia' ? 'TRIVIA' : 'PRODE');

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });
    const TAB_CONFIG = TAB_CONFIG_BASE;

    const { data: leaderboardData = { entries: [] }, isLoading: ledgerLoading } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: async () => {
            const result = await base44.functions.invoke('prodeService', { action: 'get_leaderboard' });
            return result.data;
        },
        staleTime: 60000
    });
    const allEntries = leaderboardData.entries || [];

    const getEntries = (mode) => {
        return [...allEntries].sort((a, b) => b.total_points - a.total_points);
    };

    const today = new Date().toISOString().slice(0, 10);

    const { data: triviaBoard = { today: [], allTime: [] } } = useQuery({
        queryKey: ['triviaLeaderboard', today],
        queryFn: async () => {
            const res = await base44.functions.invoke('triviaLeaderboard', { date: today });
            return res.data;
        },
        enabled: tab === 'TRIVIA'
    });

    const entries = getEntries(tab);
    const myRank = entries.findIndex(e => e.user_id === currentUser?.id) + 1;

    const triviaRanked = triviaBoard.today;
    const myTriviaRank = triviaRanked.findIndex(a => a.user_id === currentUser?.id) + 1;
    const myTriviaPoints = triviaRanked.find(a => a.user_id === currentUser?.id)?.points ?? 0;

    if (ledgerLoading) {
        return (
            <div className="max-w-2xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading standings...
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
            <WorldCupBanner compact />
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.orange }}>
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, margin: 0 }}>
                            ⚽ Leaderboard
                        </h1>
                        <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                            UnityCup: FIFA World Cup 2026 Standings
                        </p>
                    </div>
                </div>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280' }}>
                    {(tab === 'TRIVIA' ? triviaRanked.length : entries.length)} participant{(tab === 'TRIVIA' ? triviaRanked.length : entries.length) !== 1 ? 's' : ''}
                    {myRank > 0 && (
                        <> · You're ranked <span style={{ fontWeight: 700, color: CU.charcoal }}>#{myRank}</span></>
                    )}
                </p>
            </div>

            {/* My position */}
            {(tab === 'TRIVIA' || myRank > 0) && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: CU.orange + '15', border: `1px solid ${CU.orange}40` }}>
                    <div className="flex items-center gap-3">
                        <RankBadge rank={tab === 'TRIVIA' ? (myTriviaRank || '—') : myRank} />
                        <div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.875rem', color: CU.charcoal }}>
                                Your {tab === 'TRIVIA' ? 'Trivia' : 'Prode'} Position
                            </div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#6b7280' }}>
                                {tab === 'TRIVIA'
                                    ? `${myTriviaPoints} Trivia points today`
                                    : `${entries[myRank - 1]?.total_points || 0} Prode points`}
                            </div>
                        </div>
                    </div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal }}>
                        {tab === 'TRIVIA' ? myTriviaPoints : (entries[myRank - 1]?.total_points || 0)}
                    </div>
                </div>
            )}

            {/* Tab buttons */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
                {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                    <button
                        key={value}
                        onClick={() => setTab(value)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            fontWeight: 600,
                            background: tab === value ? 'white' : 'transparent',
                            color: tab === value ? CU.magenta : '#6b7280',
                            borderBottom: tab === value ? `2px solid ${CU.magenta}` : '2px solid transparent',
                            border: tab === value ? `1px solid #e5e7eb` : '1px solid transparent',
                            cursor: 'pointer'
                        }}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Table — Trivia tab gets its own renderer */}
            {tab === 'TRIVIA' ? (
                <TriviaLeaderboard
                    today={triviaBoard.today}
                    allTime={triviaBoard.allTime}
                    currentUserId={currentUser?.id}
                />
            ) : (
                <LeaderboardTable entries={entries} currentUserId={currentUser?.id} mode={tab} />
            )}
        </div>
    );
}

function TriviaLeaderboard({ today, allTime, currentUserId }) {
    const [view, setView] = useState('TODAY');
    const rows = view === 'TODAY' ? today : allTime;

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                {['TODAY', 'ALL_TIME'].map(v => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        className="px-4 py-1.5 rounded-full text-sm transition-colors"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            fontWeight: 600,
                            background: view === v ? CU.charcoal : '#f3f4f6',
                            color: view === v ? 'white' : '#6b7280',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {v === 'TODAY' ? 'Today' : 'All-time'}
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-12" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {view === 'TODAY' ? 'No trivia scores yet today.' : 'No engagement points yet.'}
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rows.map((row, i) => {
                        const rank = i + 1;
                        const isMe = row.user_id === currentUserId;
                        return (
                            <div
                                key={row.user_id}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
                                style={{
                                    background: isMe ? CU.orange + '18' : 'white',
                                    border: isMe ? `1px solid ${CU.orange}50` : '1px solid transparent',
                                }}
                            >
                                <RankBadge rank={rank} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: CU.charcoal }}>
                                        {rank === 1 && <span className="mr-1">🏆</span>}
                                        {isMe
                                            ? <Link to="/Profile" style={{ color: 'inherit', textDecoration: 'none' }}>{row.display_name}</Link>
                                            : <span>{row.display_name}</span>
                                        }
                                        {isMe && (
                                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                                                  style={{ background: CU.orange + '30', color: CU.charcoal, fontWeight: 700 }}>you</span>
                                        )}
                                    </div>
                                    <div className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>{row.department}</div>
                                </div>
                                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', color: CU.charcoal }}>
                                    {row.points}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}