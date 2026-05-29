import React from 'react';
import { CU } from './wcTokens';

/* ── Single scheduled fixture row ────────────────────────── */
export default function FixtureRow({ match, teams }) {
    const homeTeam = teams[match.home_team_id];
    const awayTeam = teams[match.away_team_id];
    const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
    const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';

    const kickoff = new Date(match.kickoff_at);

    return (
        <div
            className="rounded-xl border bg-white"
            style={{ borderColor: '#e5e7eb' }}
        >
            {/* Date / time / venue */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {kickoff.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {match.venue && (
                    <span className="text-xs truncate ml-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#d1d5db' }}>
                        {match.venue}
                    </span>
                )}
            </div>

            {/* Teams */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                {/* Home */}
                <div className="flex-1 flex items-center justify-end gap-2 text-right">
                    <div>
                        <div className="text-lg font-bold leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            {homeName}
                        </div>
                        {homeTeam?.name && (
                            <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                {homeTeam.name}
                            </div>
                        )}
                    </div>
                    {homeTeam?.logo_url && (
                        <img src={homeTeam.logo_url} alt={homeName} className="w-8 h-8 object-contain shrink-0" />
                    )}
                </div>

                <span className="text-sm font-semibold shrink-0 px-1" style={{ color: '#d1d5db', fontFamily: "'Raleway', sans-serif" }}>
                    vs
                </span>

                {/* Away */}
                <div className="flex-1 flex items-center justify-start gap-2 text-left">
                    {awayTeam?.logo_url && (
                        <img src={awayTeam.logo_url} alt={awayName} className="w-8 h-8 object-contain shrink-0" />
                    )}
                    <div>
                        <div className="text-lg font-bold leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            {awayName}
                        </div>
                        {awayTeam?.name && (
                            <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                {awayTeam.name}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}