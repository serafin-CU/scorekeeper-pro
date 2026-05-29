import React from 'react';
import { CU } from '@/components/feed/feedConstants';

const outcome = (h, a) => (h > a ? 'H' : h < a ? 'A' : 'D');

export default function FinishedPredictions({ predictions = [] }) {
    if (predictions.length === 0) return null;

    return (
        <>
            <h2 className="mb-3" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: CU.charcoal }}>
                Past Predictions
            </h2>
            <div className="space-y-2 mb-6">
                {predictions.map(p => {
                    const exact = p.pred_home_goals === p.actual_home_goals && p.pred_away_goals === p.actual_away_goals;
                    const correctOutcome = outcome(p.pred_home_goals, p.pred_away_goals) === outcome(p.actual_home_goals, p.actual_away_goals);
                    const color = exact ? CU.green : correctOutcome ? CU.orange : '#9ca3af';
                    const label = exact ? 'Exact' : correctOutcome ? 'Outcome' : 'Miss';

                    return (
                        <div key={p.match_id} className="rounded-xl p-3 flex items-center justify-between gap-3"
                            style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                            <div className="flex items-center gap-3 min-w-0" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                                <span className="font-semibold text-sm">{p.home_team} vs {p.away_team}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                                    <span style={{ color: '#9ca3af' }}>Predicted </span>
                                    <span style={{ color: CU.charcoal, fontWeight: 600 }}>{p.pred_home_goals}–{p.pred_away_goals}</span>
                                    <span style={{ color: '#d1d5db' }}> · </span>
                                    <span style={{ color: '#9ca3af' }}>Actual </span>
                                    <span style={{ color: CU.charcoal, fontWeight: 600 }}>{p.actual_home_goals}–{p.actual_away_goals}</span>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color + '20', color, fontFamily: "'Raleway', sans-serif", fontWeight: 600 }}>
                                    {label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}