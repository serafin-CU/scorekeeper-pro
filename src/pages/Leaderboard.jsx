import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, TrendingUp, Loader2, Crown } from 'lucide-react';

function RankBadge({ rank }) {
    if (rank === 1) return <div className="w-7 h-7 rounded-full bg-yellow-400 text-white flex items-center justify-center text-xs font-bold shadow-sm">1</div>;
    if (rank === 2) return <div className="w-7 h-7 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold shadow-sm">2</div>;
    if (rank === 3) return <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">3</div>;
    return <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium">{rank}</div>;
}

function LeaderboardTable({ entries, currentUserId, mode }) {
    if (entries.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
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
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                            isMe ? 'bg-blue-50 border border-blue-200' : rank <= 3 ? 'bg-gray-50' : ''
                        }`}
                    >
                        <RankBadge rank={rank} />
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
                                {entry.display_name || entry.email || entry.user_id.slice(-8)}
                                {isMe && <span className="text-xs text-blue-500 ml-1.5">(you)</span>}
                            </div>
                        </div>
                        {mode === 'ALL' && (
                            <div className="flex gap-4 text-xs text-gray-400">
                                <span title="Prode">P: {entry.prode_points}</span>
                                <span title="Fantasy">F: {entry.fantasy_points}</span>
                            </div>
                        )}
                        <div className={`text-lg font-bold ${rank <= 3 ? 'text-gray-900' : 'text-gray-700'}`}>
                            {entry.total_points}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function Leaderboard() {
    const [tab, setTab] = useState('ALL');

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
        queryKey: ['leaderboardLedger'],
        queryFn: () => base44.entities.PointsLedger.list()
    });

    const { data: users = [] } = useQuery({
        queryKey: ['allUsers'],
        queryFn: async () => {
            try {
                return await base44.entities.AppUser.list();
            } catch {
                return [];
            }
        }
    });

    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Aggregate points by user and mode
    const aggregated = {};
    for (const entry of ledger) {
        if (!entry.user_id) continue;
        if (!aggregated[entry.user_id]) {
            const user = usersMap[entry.user_id];
            aggregated[entry.user_id] = {
                user_id: entry.user_id,
                display_name: user?.full_name || user?.name || null,
                email: user?.email || null,
                prode_points: 0,
                fantasy_points: 0,
                total_points: 0
            };
        }
        const pts = entry.points || 0;
        if (entry.mode === 'PRODE') {
            aggregated[entry.user_id].prode_points += pts;
        } else if (entry.mode === 'FANTASY') {
            aggregated[entry.user_id].fantasy_points += pts;
        }
        // Penalties (mode === 'PENALTY') would subtract — but transfers are free now
        aggregated[entry.user_id].total_points += pts;
    }

    const allEntries = Object.values(aggregated);

    // Sort and filter by tab
    const getEntries = (mode) => {
        let entries;
        if (mode === 'ALL') {
            entries = [...allEntries].sort((a, b) => b.total_points - a.total_points);
        } else if (mode === 'PRODE') {
            entries = [...allEntries]
                .map(e => ({ ...e, total_points: e.prode_points }))
                .filter(e => e.total_points !== 0)
                .sort((a, b) => b.total_points - a.total_points);
        } else {
            entries = [...allEntries]
                .map(e => ({ ...e, total_points: e.fantasy_points }))
                .filter(e => e.total_points !== 0)
                .sort((a, b) => b.total_points - a.total_points);
        }
        return entries;
    };

    const entries = getEntries(tab);
    const myRank = entries.findIndex(e => e.user_id === currentUser?.id) + 1;

    if (ledgerLoading) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading standings...
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    Leaderboard
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {entries.length} participant{entries.length !== 1 ? 's' : ''}
                    {myRank > 0 && <> · You're ranked <span className="font-semibold text-gray-700">#{myRank}</span></>}
                </p>
            </div>

            {/* My position highlight */}
            {myRank > 0 && (
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="pt-4 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <RankBadge rank={myRank} />
                            <div>
                                <div className="text-sm font-medium text-blue-700">Your Position</div>
                                <div className="text-xs text-blue-500">
                                    {tab === 'ALL' ? `${entries[myRank - 1]?.prode_points || 0} Prode + ${entries[myRank - 1]?.fantasy_points || 0} Fantasy` : `${entries[myRank - 1]?.total_points || 0} points`}
                                </div>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                            {entries[myRank - 1]?.total_points || 0}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ALL">
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Overall
                    </TabsTrigger>
                    <TabsTrigger value="PRODE">
                        <Medal className="w-3.5 h-3.5 mr-1.5" /> Prode
                    </TabsTrigger>
                    <TabsTrigger value="FANTASY">
                        <Crown className="w-3.5 h-3.5 mr-1.5" /> Fantasy
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ALL" className="mt-4">
                    <LeaderboardTable entries={getEntries('ALL')} currentUserId={currentUser?.id} mode="ALL" />
                </TabsContent>
                <TabsContent value="PRODE" className="mt-4">
                    <LeaderboardTable entries={getEntries('PRODE')} currentUserId={currentUser?.id} mode="PRODE" />
                </TabsContent>
                <TabsContent value="FANTASY" className="mt-4">
                    <LeaderboardTable entries={getEntries('FANTASY')} currentUserId={currentUser?.id} mode="FANTASY" />
                </TabsContent>
            </Tabs>
        </div>
    );
}