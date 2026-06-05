import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    blue: '#475CC7',
};

function TeamSide({ team }) {
    return (
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            {team?.logo_url
                ? <img src={team.logo_url} alt={team?.name} className="w-10 h-10 object-contain" />
                : <div className="w-10 h-10 rounded-full" style={{ background: '#f3f4f6' }} />}
            <span className="truncate max-w-full" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: CU.charcoal }}>
                {team?.name || team?.fifa_code || '???'}
            </span>
        </div>
    );
}

function MatchCard({ match, teamsMap, isLive }) {
    const home = teamsMap[match.home_team_id];
    const away = teamsMap[match.away_team_id];
    const kickoff = new Date(match.kickoff_at);

    return (
        <motion.div
            style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}
            initial={{ scale: 1 }}
            whileHover={{
                scale: 1.02,
                boxShadow: `0 14px 32px -10px rgba(0,0,0,0.18), 0 0 0 2px ${CU.orange}`,
            }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
            <div style={{ height: '3px', background: isLive ? '#ef4444' : CU.orange }} />
            <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4" style={{ color: isLive ? '#ef4444' : CU.orange }} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: CU.charcoal }}>
                        {isLive ? 'Match In Progress' : 'Next Match to Predict'}
                    </span>
                    {isLive && (
                        <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: '#fee2e2' }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.7rem', color: '#ef4444' }}>LIVE</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 mb-4">
                    <TeamSide team={home} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", color: '#9ca3af', fontSize: '0.9rem' }}>vs</span>
                    <TeamSide team={away} />
                </div>

                <div className="text-center mb-4" style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.8rem', color: isLive ? '#ef4444' : '#6b7280', fontWeight: isLive ? 700 : 400 }}>
                    {isLive ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                            LIVE
                        </span>
                    ) : (
                        <>
                            {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {kickoff.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </>
                    )}
                </div>

                <Link to="/ProdePredictions" className="block">
                    <button
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg"
                        style={{ background: CU.charcoal, color: 'white', fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
                    >
                        Predict Now <ChevronRight className="w-4 h-4" />
                    </button>
                </Link>
            </div>
        </motion.div>
    );
}

export default function NextMatchCard({ matches, teams, predictions }) {
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const now = new Date();

    // A match is LIVE if it has kicked off but isn't finalized yet.
    const live = matches
        .filter(m => m.status !== 'FINAL' && new Date(m.kickoff_at) <= now)
        .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

    const upcoming = matches
        .filter(m => m.status !== 'FINAL' && new Date(m.kickoff_at) > now)
        .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));

    const isLive = live.length > 0;
    const pool = isLive ? live : upcoming;

    if (pool.length === 0) return null;

    // Group Stage MD3 schedules pairs of matches at the same kickoff time (max 2 concurrent).
    const targetTime = new Date(pool[0].kickoff_at).getTime();
    const nextMatches = pool.filter(m => new Date(m.kickoff_at).getTime() === targetTime).slice(0, 2);

    return (
        <div className={`grid gap-4 ${nextMatches.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {nextMatches.map(m => (
                <MatchCard key={m.id} match={m} teamsMap={teamsMap} isLive={isLive} />
            ))}
        </div>
    );
}