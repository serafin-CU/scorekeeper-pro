import React from 'react';
import { CU } from '@/components/feed/feedConstants';

function outcome(h, a) {
    if (h > a) return 'H';
    if (h < a) return 'A';
    return 'D';
}

function PredictionRow({ p }) {
    const exact = p.pred_home_goals === p.actual_home_goals && p.pred_away_goals === p.actual_away_goals;
    const correctOutcome = outcome(p.pred_home_goals, p.pred_away_goals) === outcome(p.actual_home_goals, p.actual_away_goals);
    const color = exact ? CU.green : correctOutcome ? CU.orange : '#9ca3af';
    const label = exact ? 'Exact' : correctOutcome ? 'Outcome' : 'Miss';

    return (
        <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
            <div className="flex items-center gap-2 min-w-0" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                <span className="font-semibold text-sm">{p.home_team.fifa_code}</span>
                <span className="text-xs text-gray-400">vs</span>
                <span className="font-semibold text-sm">{p.away_team.fifa_code}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-center">
                    <div className="text-xs text-gray-400" style={{ fontFamily: "'Raleway', sans-serif" }}>Pick</div>
                    <div className="text-sm font-semibold" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>{p.pred_home_goals}-{p.pred_away_goals}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-400" style={{ fontFamily: "'Raleway', sans-serif" }}>Final</div>
                    <div className="text-sm font-semibold" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>{p.actual_home_goals}-{p.actual_away_goals}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color + '22', color, fontFamily: "'Raleway', sans-serif", fontWeight: 600 }}>
                    {label}
                </span>
            </div>
        </div>
    );
}

export default function PastPredictions({ predictions }) {
    if (!predictions || predictions.length === 0) return null;

    return (
        <div className="mb-6">
            <h2 className="mb-3" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: CU.charcoal }}>
                Past Predictions
            </h2>
            <div className="space-y-2">
                {predictions.map(p => <PredictionRow key={p.match_id} p={p} />)}
            </div>
        </div>
    );
}