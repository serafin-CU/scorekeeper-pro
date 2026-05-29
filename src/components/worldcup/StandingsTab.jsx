import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { CU } from './wcTokens';

/* ── Single group standings table ────────────────────────── */
function GroupTable({ group }) {
    if (!group?.teams?.length) return null;

    return (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            <div className="px-4 py-3" style={{ background: CU.charcoal }}>
                <h3 className="text-base font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: 'white' }}>
                    {group.name}
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                    <thead>
                        <tr className="border-b text-xs" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
                            <th className="text-center py-2 px-2 font-semibold">#</th>
                            <th className="text-left py-2 px-2 font-semibold">Team</th>
                            <th className="text-center py-2 px-2 font-semibold">P</th>
                            <th className="text-center py-2 px-2 font-semibold">W</th>
                            <th className="text-center py-2 px-2 font-semibold">D</th>
                            <th className="text-center py-2 px-2 font-semibold">L</th>
                            <th className="text-center py-2 px-2 font-semibold">GF</th>
                            <th className="text-center py-2 px-2 font-semibold">GA</th>
                            <th className="text-center py-2 px-2 font-semibold">GD</th>
                            <th className="text-center py-2 px-2 font-semibold">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {group.teams.map(team => (
                            <tr key={team.team_id} className="border-b hover:bg-gray-50" style={{ borderColor: '#f3f4f6' }}>
                                <td className="py-3 px-2 text-center font-semibold" style={{ color: '#9ca3af' }}>{team.rank}</td>
                                <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                        {team.team_logo && (
                                            <img src={team.team_logo} alt={team.team_name} className="w-5 h-5 object-contain shrink-0" />
                                        )}
                                        <span className="font-semibold" style={{ color: CU.charcoal }}>{team.team_name}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.played}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.wins}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.draws}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.losses}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.goals_for}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.goals_against}</td>
                                <td className="py-3 px-2 text-center" style={{ color: '#6b7280' }}>{team.goal_diff}</td>
                                <td className="py-3 px-2 text-center font-bold rounded" style={{ color: CU.charcoal, background: CU.orange + '15' }}>
                                    {team.points}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ── Standings tab: group stage tables ───────────────────── */
export default function StandingsTab() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['wcStandings'],
        queryFn: async () => {
            const res = await base44.functions.invoke('wcStandingsSync', { action: 'get_standings' });
            if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to load standings');
            return res.data.groups || [];
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 py-16 justify-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading standings...
            </div>
        );
    }

    if (error || !data || data.length === 0) {
        return (
            <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No standings data available yet.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {data.map(group => (
                <GroupTable key={group.name} group={group} />
            ))}
        </div>
    );
}