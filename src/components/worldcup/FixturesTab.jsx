import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { CU, PHASE_LABELS, PHASE_ORDER } from './wcTokens';
import FixtureRow from './FixtureRow';
import PlayingNext from './PlayingNext';

/* ── Fixtures tab: all scheduled matches grouped by round ── */
export default function FixturesTab() {
    const { data: matches = [], isLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.filter({ kickoff_at: { $gte: '2026-06-01T00:00:00Z' } }),
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list(),
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    // Group by phase
    const phases = {};
    for (const match of matches) {
        if (!phases[match.phase]) phases[match.phase] = [];
        phases[match.phase].push(match);
    }
    for (const phase in phases) {
        phases[phase].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
    }

    const orderedPhases = PHASE_ORDER.filter(p => phases[p]?.length > 0);

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 py-16 justify-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading fixtures...
            </div>
        );
    }

    if (orderedPhases.length === 0) {
        return (
            <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No matches scheduled yet. Check back soon!
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PlayingNext matches={matches} teams={teamsMap} />
            {orderedPhases.map(phase => (
                <div key={phase}>
                    <h2
                        className="text-lg font-bold mb-3"
                        style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}
                    >
                        {PHASE_LABELS[phase] || phase}
                        <span className="ml-2 text-sm font-normal" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                            {phases[phase].length} {phases[phase].length === 1 ? 'match' : 'matches'}
                        </span>
                    </h2>
                    <div className="space-y-3">
                        {phases[phase].map(match => (
                            <FixtureRow key={match.id} match={match} teams={teamsMap} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}