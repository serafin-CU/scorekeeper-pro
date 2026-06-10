import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Brain, Flame, Loader2 } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

// Current consecutive-day streak ending at today (or yesterday if today not played)
function computeStreak(dates) {
    if (!dates || dates.length === 0) return 0;
    const set = new Set(dates);
    let streak = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    if (!set.has(iso(cursor))) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (set.has(iso(cursor))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

export default function TriviaRecords({ userId }) {
    const { data: records = [], isLoading } = useQuery({
        queryKey: ['triviaRecords', userId],
        queryFn: () => base44.entities.TriviaRecord.filter({ user_id: userId }, '-date', 365),
        enabled: !!userId
    });

    const streak = computeStreak(records.map(r => r.date));

    return (
        <div className="bg-white rounded-2xl shadow-sm p-8 mt-6">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5" style={{ color: CU.magenta }} />
                    <h2 className="text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        Trivia Records
                    </h2>
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                    <span>{records.length} set{records.length !== 1 ? 's' : ''}</span>
                    {streak > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                              style={{ background: CU.orange + '20', color: CU.charcoal, fontWeight: 600 }}>
                            <Flame className="w-3.5 h-3.5" style={{ color: CU.orange }} /> {streak} day{streak !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: CU.orange }} />
                </div>
            ) : records.length === 0 ? (
                <div className="text-center py-8 rounded-xl text-sm"
                     style={{ background: '#f9fafb', border: '1px dashed #e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                    No trivia sets completed yet.
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                    {records.map((r, i) => (
                        <div
                            key={r.id || r.date}
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f1f1' }}
                        >
                            <div className="text-sm font-semibold" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                                {r.date ? format(parseISO(r.date), 'EEE, MMM d, yyyy') : '—'}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                    {r.correct_answers}/{r.total_questions} correct
                                </span>
                                <span className="text-sm font-bold px-3 py-1 rounded-full"
                                      style={{ fontFamily: "'Raleway', sans-serif", background: CU.orange + '20', color: CU.charcoal }}>
                                    +{r.score} pts
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}