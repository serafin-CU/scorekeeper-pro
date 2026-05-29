import React from 'react';
import { CU } from './wcTokens';

/* ── Single completed-match result row ───────────────────── */
export default function ResultRow({ match, teams, result }) {
    const homeTeam = teams[match.home_team_id];
    const awayTeam = teams[match.away_team_id];
    const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
    const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';

    const kickoff = new Date(match.kickoff_at);
    const homeGoals = result?.home_goals;
    const awayGoals = result?.away_goals;
    const hasScore = homeGoals != null && awayGoals != null;

    const homeWin = hasScore && homeGoals > awayGoals;
    const awayWin = hasScore && awayGoals > homeGoals;

    return (
        <div className="rounded-xl border bg-white" style={{ borderColor: '#e5e7eb' }}>
            {/* Date / time / venue */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500" style={{ fontFamily: "'Raleway', sans-serif" }}>
                    Final
                </span>
            </div>

            {/* Teams + prominent score */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                {/* Home */}
                <div className="flex-1 flex items-center justify-end gap-2 text-right">
                    <div className="text-base font-bold leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: homeWin ? CU.charcoal : '#9ca3af' }}>
                        {homeName}
                    </div>
                    {homeTeam?.logo_url && (
                        <img src={homeTeam.logo_url} alt={homeName} className="w-7 h-7 object-contain shrink-0" style={{ opacity: awayWin ? 0.5 : 1 }} />
                    )}
                </div>

                {/* Score */}
                <div
                    className="flex items-center gap-2 shrink-0 px-3 py-1 rounded-lg"
                    style={{ background: CU.charcoal }}
                >
                    <span className="text-2xl font-bold leading-none" style={{ fontFamily: "'DM Serif Display', serif", color: 'white' }}>
                        {hasScore ? homeGoals : '–'}
                    </span>
                    <span className="text-lg font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>–</span>
                    <span className="text-2xl font-bold leading-none" style={{ fontFamily: "'DM Serif Display', serif", color: 'white' }}>
                        {hasScore ? awayGoals : '–'}
                    </span>
                </div>

                {/* Away */}
                <div className="flex-1 flex items-center justify-start gap-2 text-left">
                    {awayTeam?.logo_url && (
                        <img src={awayTeam.logo_url} alt={awayName} className="w-7 h-7 object-contain shrink-0" style={{ opacity: homeWin ? 0.5 : 1 }} />
                    )}
                    <div className="text-base font-bold leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: awayWin ? CU.charcoal : '#9ca3af' }}>
                        {awayName}
                    </div>
                </div>
            </div>
        </div>
    );
}