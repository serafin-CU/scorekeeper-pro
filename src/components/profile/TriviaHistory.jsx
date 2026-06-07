import React from 'react';
import { format, parseISO } from 'date-fns';
import { CU } from '@/components/feed/feedConstants';

export default function TriviaHistory({ triviaPoints, history }) {
    const rows = Array.isArray(history) ? history : [];

    return (
        <div className="space-y-4">
            {/* Total */}
            <div className="rounded-xl p-6 text-center" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.5rem', color: CU.charcoal, lineHeight: 1 }}>
                    {triviaPoints ?? 0}
                </div>
                <div className="text-sm mt-1" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: '#6b7280' }}>
                    Total Trivia Points
                </div>
            </div>

            {/* Per-day breakdown */}
            {rows.length === 0 ? (
                <div className="text-center py-8 rounded-xl text-sm" style={{ background: 'white', border: '1px dashed #e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                    No trivia played yet.
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                    {rows.map((r, i) => (
                        <div
                            key={r.date || i}
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f1f1' }}
                        >
                            <div className="min-w-0 pr-3">
                                <div className="text-sm font-semibold" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                                    {r.date ? format(parseISO(r.date), 'EEE, MMM d') : '—'}
                                </div>
                                {r.theme && (
                                    <div className="text-xs mt-0.5 truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                                        {r.theme}
                                    </div>
                                )}
                                <div className="text-xs mt-0.5" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                    {r.correct_count}/{r.question_count || 5} correct
                                </div>
                            </div>
                            <div
                                className="text-sm font-bold px-3 py-1 rounded-full shrink-0"
                                style={{ fontFamily: "'Raleway', sans-serif", background: CU.orange + '20', color: CU.charcoal }}
                            >
                                +{r.total_points} pts
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}