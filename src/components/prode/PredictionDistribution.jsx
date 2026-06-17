import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, ChevronDown, Loader2 } from 'lucide-react';

const CU = {
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    orange: '#FFB81C',
    green: '#218848',
};

/**
 * Expandable, scrollable distribution of all users' score predictions for a
 * locked/final match. `actualScoreline` (e.g. "2-1") highlights the bar that
 * matches the real result.
 */
export default function PredictionDistribution({ matchId, actualScoreline }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [total, setTotal] = useState(0);
    const [rows, setRows] = useState([]);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next && !loaded) {
            setLoading(true);
            try {
                const res = await base44.functions.invoke('prodeService', {
                    action: 'get_prediction_distribution',
                    match_id: matchId
                });
                setRows(res.data?.distribution || []);
                setTotal(res.data?.total || 0);
                setLoaded(true);
            } catch (err) {
                console.error('[PredictionDistribution] failed:', err);
            }
            setLoading(false);
        }
    };

    const maxPercent = rows.length > 0 ? Math.max(...rows.map(r => r.percent)) : 0;

    return (
        <div className="px-4 pb-3">
            <button
                onClick={toggle}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#f3f4f6', color: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}
            >
                <BarChart3 className="w-3.5 h-3.5" style={{ color: CU.magenta }} />
                {open ? 'Hide' : 'See'} prediction distribution
                <ChevronDown
                    className="w-3.5 h-3.5 transition-transform"
                    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
                />
            </button>

            {open && (
                <div className="mt-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: CU.orange }} />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-center text-xs py-3" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                            No predictions for this match.
                        </p>
                    ) : (
                        <>
                            <div className="text-center text-xs mb-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                {total} prediction{total !== 1 ? 's' : ''} total
                            </div>
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                                {rows.map((r) => {
                                    const isActual = r.scoreline === actualScoreline;
                                    const barColor = isActual ? CU.green : CU.magenta;
                                    const width = maxPercent > 0 ? (r.percent / maxPercent) * 100 : 0;
                                    return (
                                        <div key={r.scoreline} className="flex items-center gap-2">
                                            <span
                                                className="text-xs font-bold w-10 text-right tabular-nums flex-shrink-0"
                                                style={{ fontFamily: "'DM Serif Display', serif", color: isActual ? CU.green : CU.charcoal }}
                                            >
                                                {r.home}–{r.away}
                                            </span>
                                            <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#f3f4f6' }}>
                                                <div
                                                    className="h-full rounded-md transition-all"
                                                    style={{ width: `${Math.max(width, 4)}%`, background: barColor + (isActual ? 'ff' : '99') }}
                                                />
                                            </div>
                                            <span
                                                className="text-xs font-semibold w-12 text-right tabular-nums flex-shrink-0"
                                                style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}
                                            >
                                                {r.percent}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}