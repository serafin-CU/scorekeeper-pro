import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
};

function outcome(h, a) {
    if (h > a) return 'home';
    if (h < a) return 'away';
    return 'draw';
}

/* Computes how many points the user earned for this final result */
function scorePrediction(pred, result) {
    if (!pred) return null;
    const exact = pred.pred_home_goals === result.home_goals && pred.pred_away_goals === result.away_goals;
    if (exact) return { points: 5, label: 'Exact score', color: CU.green };
    if (outcome(pred.pred_home_goals, pred.pred_away_goals) === outcome(result.home_goals, result.away_goals)) {
        return { points: 3, label: 'Correct outcome', color: CU.blue };
    }
    return { points: 0, label: 'Missed', color: '#9ca3af' };
}

export default function FinalMatchRow({ match, teams, savedPrediction, result }) {
    const homeTeam = teams[match.home_team_id];
    const awayTeam = teams[match.away_team_id];
    const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
    const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';
    const homeFullName = homeTeam?.name || '';
    const awayFullName = awayTeam?.name || '';

    const kickoff = new Date(match.kickoff_at);
    const scoring = result ? scorePrediction(savedPrediction, result) : null;

    return (
        <div className="rounded-xl border" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
            {/* Date / Status bar */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {kickoff.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500"
                      style={{ fontFamily: "'Raleway', sans-serif" }}>
                    Final
                </span>
            </div>

            {/* Teams + actual result */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 pb-3 pt-1">
                <div className="flex-1 min-w-0 flex flex-col items-end text-right pr-1 sm:pr-2 gap-1">
                    {homeTeam?.logo_url && (
                        <img src={homeTeam.logo_url} alt={homeName} className="w-8 h-8 object-contain" />
                    )}
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {homeName}
                    </div>
                    <div className="text-xs truncate w-full" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        {homeFullName}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="text-3xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {result ? result.home_goals : '–'}
                    </div>
                    <span className="text-xl font-light" style={{ color: '#d1d5db', fontFamily: "'DM Serif Display', serif" }}>×</span>
                    <div className="text-3xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {result ? result.away_goals : '–'}
                    </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col items-start pl-1 sm:pl-2 gap-1">
                    {awayTeam?.logo_url && (
                        <img src={awayTeam.logo_url} alt={awayName} className="w-8 h-8 object-contain" />
                    )}
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {awayName}
                    </div>
                    <div className="text-xs truncate w-full" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        {awayFullName}
                    </div>
                </div>
            </div>

            {/* Prediction outcome footer */}
            <div className="px-4 pb-3 flex flex-wrap items-center justify-center gap-2 text-xs" style={{ fontFamily: "'Raleway', sans-serif" }}>
                {savedPrediction ? (
                    <>
                        <span style={{ color: '#9ca3af' }}>
                            Your prediction: {savedPrediction.pred_home_goals} – {savedPrediction.pred_away_goals}
                        </span>
                        {scoring && (
                            <span className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: scoring.color + '18', color: scoring.color }}>
                                {scoring.points > 0
                                    ? <CheckCircle className="w-3 h-3" />
                                    : <XCircle className="w-3 h-3" />}
                                {scoring.label} · +{scoring.points} pts
                            </span>
                        )}
                    </>
                ) : (
                    <span style={{ color: '#d1d5db' }}>No prediction submitted</span>
                )}
            </div>
        </div>
    );
}