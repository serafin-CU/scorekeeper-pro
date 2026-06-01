import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { CU, PHASE_LABELS, PHASE_ORDER } from './wcTokens';
import ResultRow from './ResultRow';

/* ── Results tab: completed matches with final scores ────── */
export default function ResultsTab() {
    const { data: matches = [], isLoading } = useQuery({
        queryKey: ['finalMatches'],
        queryFn: () => base44.entities.Match.filter({ status: 'FINAL' }),
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list(),
    });

    const { data: results = [] } = useQuery({
        queryKey: ['matchResultsFinal'],
        queryFn: () => base44.entities.MatchResultFinal.list(),
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const resultsMap = Object.fromEntries(results.map(r => [r.match_id, r]));

    // Guard: only include matches that have actually been played and have a final result.
    // Protects against records incorrectly flagged FINAL (future match, no scores).
    const now = new Date();
    const playedMatches = matches.filter(
        m => new Date(m.kickoff_at) <= now && resultsMap[m.id] != null
    );

    // Group by phase, most recent first within each phase
    const phases = {};
    for (const match of playedMatches) {
        if (!phases[match.phase]) phases[match.phase] = [];
        phases[match.phase].push(match);
    }
    for (const phase in phases) {
        phases[phase].sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));
    }

    const orderedPhases = PHASE_ORDER.filter(p => phases[p]?.length > 0);

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 py-16 justify-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading results...
            </div>
        );
    }

    if (orderedPhases.length === 0) {
        return (
            <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No completed matches yet. Results will appear here once matches finish!
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {orderedPhases.map(phase => (
                <div key={phase}>
                    <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {PHASE_LABELS[phase] || phase}
                        <span className="ml-2 text-sm font-normal" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                            {phases[phase].length} {phases[phase].length === 1 ? 'result' : 'results'}
                        </span>
                    </h2>
                    <div className="space-y-3">
                        {phases[phase].map(match => (
                            <ResultRow key={match.id} match={match} teams={teamsMap} result={resultsMap[match.id]} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}