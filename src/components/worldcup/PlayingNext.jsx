import React from 'react';
import { Zap } from 'lucide-react';
import { CU } from './wcTokens';
import FixtureRow from './FixtureRow';

/* ── "Playing Next" — next 3 upcoming scheduled matches ── */
export default function PlayingNext({ matches, teams }) {
    const now = new Date();
    const upcoming = matches
        .filter(m => m.status === 'SCHEDULED' && new Date(m.kickoff_at) >= now)
        .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
        .slice(0, 3);

    if (upcoming.length === 0) return null;

    return (
        <div
            className="rounded-2xl p-4"
            style={{ background: `${CU.sand}1a`, border: `1.5px solid ${CU.sand}` }}
        >
            <h2
                className="text-lg font-bold mb-3 flex items-center gap-2"
                style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}
            >
                <Zap className="w-4 h-4" style={{ color: CU.sand }} />
                Playing Next
            </h2>
            <div className="space-y-3">
                {upcoming.map(match => (
                    <FixtureRow key={match.id} match={match} teams={teams} />
                ))}
            </div>
        </div>
    );
}