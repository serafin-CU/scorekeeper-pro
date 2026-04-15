import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const CU = { orange: '#FFB81C', charcoal: '#2C2B2B' };

function StandingsTable({ group }) {
    if (!group || !group.teams) return null;

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="text-lg" style={{ color: CU.charcoal }}>
                    {group.name}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b" style={{ borderColor: '#e5e7eb' }}>
                                <th className="text-left py-2 px-2 font-semibold">Pos</th>
                                <th className="text-left py-2 px-2 font-semibold">Team</th>
                                <th className="text-center py-2 px-2 font-semibold">P</th>
                                <th className="text-center py-2 px-2 font-semibold">W</th>
                                <th className="text-center py-2 px-2 font-semibold">D</th>
                                <th className="text-center py-2 px-2 font-semibold">L</th>
                                <th className="text-center py-2 px-2 font-semibold">GF</th>
                                <th className="text-center py-2 px-2 font-semibold">GA</th>
                                <th className="text-center py-2 px-2 font-semibold">GD</th>
                                <th className="text-center py-2 px-2 font-semibold font-bold">Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group.teams.map((team, idx) => (
                                <tr 
                                    key={team.team_id} 
                                    className="border-b hover:bg-gray-50"
                                    style={{ borderColor: '#e5e7eb' }}
                                >
                                    <td className="py-3 px-2 font-semibold text-center text-gray-600">{team.rank}</td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-2">
                                            {team.team_logo && (
                                                <img 
                                                    src={team.team_logo} 
                                                    alt={team.team_name}
                                                    className="w-5 h-5 object-contain"
                                                />
                                            )}
                                            <span className="font-medium text-gray-800">{team.team_name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.played}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.wins}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.draws}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.losses}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.goals_for}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.goals_against}</td>
                                    <td className="py-3 px-2 text-center text-gray-600">{team.goal_diff}</td>
                                    <td 
                                        className="py-3 px-2 text-center font-bold text-lg rounded" 
                                        style={{ color: CU.charcoal, background: CU.orange + '15' }}
                                    >
                                        {team.points}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function Standings() {
    const [standings, setStandings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchStandings = async () => {
        setRefreshing(true);
        try {
            const res = await base44.functions.invoke('wcStandingsSync', { action: 'get_standings' });
            if (res.data.ok) {
                setStandings(res.data.groups);
                setLastUpdated(res.data.timestamp);
                setError(null);
            } else {
                setError(res.data.error || 'Failed to fetch standings');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchStandings().finally(() => setLoading(false));
    }, []);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
                            Group Standings
                        </h1>
                        <p className="text-gray-500 text-sm">
                            Live standings for FIFA World Cup 2026
                            {lastUpdated && (
                                <>
                                    <br />
                                    <span className="text-xs text-gray-400">Updated: {formatTime(lastUpdated)}</span>
                                </>
                            )}
                        </p>
                    </div>
                    <Button 
                        onClick={fetchStandings} 
                        disabled={refreshing}
                        style={{ background: CU.charcoal }}
                    >
                        {refreshing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                    </Button>
                </div>

                {/* Error Message */}
                {error && (
                    <Card className="mb-6 border-red-200 bg-red-50">
                        <CardContent className="pt-4 text-red-700 text-sm">
                            {error}
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: CU.orange }} />
                    </div>
                ) : standings && standings.length > 0 ? (
                    <div>
                        {standings.map((group) => (
                            <StandingsTable key={group.name} group={group} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-8 text-center text-gray-500">
                            No standings data available yet.
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}