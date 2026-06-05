import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react';

// Parse both formats:
//   New: "Day 6 – 2026-07-19 – FIFA World Cup 2026"        (en-dash, ISO date)
//   Old: "Day 1 — May 27, 2026 — {theme} — ..."            (em-dash, written date)
function parseSourceNote(sourceNote) {
    if (!sourceNote) return { dayNumber: null, date: null, embeddedTheme: null };
    const dayMatch = sourceNote.match(/Day\s+(\d+)/i);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : null;

    // ISO date (new format)
    const isoMatch = sourceNote.match(/(\d{4}-\d{2}-\d{2})/);
    // Written date e.g. "May 27, 2026" (old format)
    const writtenMatch = sourceNote.match(/([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);

    let date = null;
    if (isoMatch) {
        date = formatDate(isoMatch[1]);
    } else if (writtenMatch) {
        date = writtenMatch[1].replace(/\s+/g, ' ').trim();
    }

    // Embedded theme: the segment after the date in the old em-dash format
    let embeddedTheme = null;
    if (sourceNote.includes('—')) {
        const parts = sourceNote.split('—').map(s => s.trim());
        embeddedTheme = parts[2] || null;
    }

    return { dayNumber, date, embeddedTheme };
}

// Format YYYY-MM-DD -> "May 27, 2026"
function formatDate(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const CATEGORY_LABELS = {
    GROUP_STAGE: 'Group Stage',
    KNOCKOUT_HISTORY: 'World Cup History',
    PLAYERS_RECORDS: 'Players & Records',
    HOST_2026: 'Host Cities',
    RULES_FORMAT: 'Rules & Format',
    CULTURE_AND_FOOD: 'Culture & Food'
};

// Derive a short topic label from the most common category in the day's questions
function deriveTheme(questions) {
    const counts = {};
    for (const q of questions) {
        if (q.category) counts[q.category] = (counts[q.category] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return CATEGORY_LABELS[top[0]] || top[0];
}

function groupQuestionsByDay(questions) {
    const map = {};
    for (const q of questions) {
        const { dayNumber, date, embeddedTheme } = parseSourceNote(q.source_note);
        const key = dayNumber ?? 'unknown';
        if (!map[key]) {
            map[key] = { dayNumber: key, date, embeddedTheme, questions: [] };
        }
        if (!map[key].date && date) map[key].date = date;
        if (!map[key].embeddedTheme && embeddedTheme) map[key].embeddedTheme = embeddedTheme;
        map[key].questions.push(q);
    }
    return Object.values(map)
        .map(g => ({ ...g, theme: g.embeddedTheme || deriveTheme(g.questions) }))
        .sort((a, b) => {
            if (a.dayNumber === 'unknown') return 1;
            if (b.dayNumber === 'unknown') return -1;
            return a.dayNumber - b.dayNumber;
        });
}

function DifficultyBadge({ difficulty }) {
    const colors = {
        EASY: 'bg-green-100 text-green-800',
        MEDIUM: 'bg-yellow-100 text-yellow-800',
        HARD: 'bg-red-100 text-red-800'
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[difficulty] || 'bg-gray-100 text-gray-700'}`}>
            {difficulty}
        </span>
    );
}

function QuestionPreview({ questions }) {
    return (
        <div className="mt-3 space-y-4 pl-2 border-l-2 border-slate-200">
            {questions.map((q, i) => (
                <div key={q.id} className="text-sm">
                    <div className="flex items-start gap-2 mb-1">
                        <span className="font-semibold text-slate-500 shrink-0">Q{i + 1}.</span>
                        <span className="font-medium text-slate-800">{q.question_text}</span>
                        <div className="ml-auto shrink-0"><DifficultyBadge difficulty={q.difficulty} /></div>
                    </div>
                    <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-1 mb-1">
                        {q.options?.map((opt, idx) => (
                            <div
                                key={idx}
                                className={`px-2 py-1 rounded text-xs ${
                                    idx === q.correct_answer_index
                                        ? 'bg-green-100 text-green-800 font-semibold'
                                        : 'bg-slate-50 text-slate-600'
                                }`}
                            >
                                {['A', 'B', 'C', 'D'][idx]}. {opt}
                                {idx === q.correct_answer_index && ' ✓'}
                            </div>
                        ))}
                    </div>
                    {q.source_note && (
                        <p className="ml-6 text-xs text-slate-400 italic">
                            {q.source_note.split('—').slice(4).join('—').trim()}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

function DayRow({ group, onToggle }) {
    const [expanded, setExpanded] = useState(false);
    const [toggling, setToggling] = useState(false);
    const allActive = group.questions.every(q => q.is_active);

    const handleToggle = async (newValue) => {
        setToggling(true);
        try {
            await onToggle(group.questions, newValue);
            toast.success(`Day ${group.dayNumber} ${newValue ? 'activated' : 'deactivated'}`);
        } catch (err) {
            toast.error(`Failed to update Day ${group.dayNumber}: ${err.message}`);
        } finally {
            setToggling(false);
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-2">
            <div className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                {/* Day */}
                <div className="w-10 shrink-0 font-bold text-slate-700 text-sm">
                    {group.dayNumber !== 'unknown' ? `Day ${group.dayNumber}` : '—'}
                </div>
                {/* Date */}
                <div className="w-32 shrink-0 text-sm text-slate-500">{group.date || '—'}</div>
                {/* Theme */}
                <div className="flex-1 text-sm text-slate-700 font-medium">{group.theme || '—'}</div>
                {/* # Questions */}
                <div className="w-12 shrink-0 text-center text-sm text-slate-500">{group.questions.length}</div>
                {/* Active toggle */}
                <div className="w-16 shrink-0 flex items-center justify-center">
                    {toggling ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                        <Switch
                            checked={allActive}
                            onCheckedChange={handleToggle}
                        />
                    )}
                </div>
                {/* Preview toggle */}
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="w-8 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            </div>

            {expanded && (
                <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
                    <QuestionPreview questions={group.questions} />
                </div>
            )}
        </div>
    );
}

export default function TriviaAdmin() {
    const navigate = useNavigate();
    const { user, isLoadingAuth } = useAuth();
    const queryClient = useQueryClient();

    const [generating, setGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState('');

    const { data: questions = [], isLoading } = useQuery({
        queryKey: ['triviaQuestions'],
        queryFn: () => base44.entities.TriviaQuestion.list(),
        enabled: !!user && user.role === 'admin'
    });

    // Admin gate — after all hooks
    if (isLoadingAuth) return null;
    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const groups = groupQuestionsByDay(questions);
    const activeDaysCount = groups.filter(g => g.questions.every(q => q.is_active)).length;

    const handleToggle = async (dayQuestions, newValue) => {
        for (const q of dayQuestions) {
            await base44.entities.TriviaQuestion.update(q.id, { is_active: newValue });
        }
        queryClient.invalidateQueries({ queryKey: ['triviaQuestions'] });
    };

    const handleGenerate = async () => {
        if (!window.confirm('This will DELETE all existing trivia questions and rebuild the full 39-day calendar. Continue?')) return;
        setGenerating(true);
        let totalCreated = 0;
        try {
            // Wipe everything first so the rebuild is clean
            setGenStatus('Clearing old questions…');
            try {
                await base44.functions.invoke('generateTriviaCalendar', { wipe: true });
                queryClient.invalidateQueries({ queryKey: ['triviaQuestions'] });
            } catch (err) {
                toast.error(err.message || 'Failed to clear old questions. Stopping.');
                setGenerating(false);
                setGenStatus('');
                return;
            }

            while (true) {
                let res;
                try {
                    res = await base44.functions.invoke('generateTriviaCalendar', { batch_size: 5 });
                } catch (err) {
                    toast.error(err.message || 'A batch failed. Stopping.');
                    break;
                }

                if (!res.data?.ok) {
                    toast.error(res.data?.error || 'Generation failed');
                    break;
                }

                totalCreated += res.data.questionsCreated || 0;
                const remaining = res.data.remainingDays ?? 0;
                queryClient.invalidateQueries({ queryKey: ['triviaQuestions'] });

                if (remaining <= 0) {
                    toast.success(`Done! Generated ${totalCreated} questions.`);
                    break;
                }

                if (res.data.daysProcessed === 0) {
                    toast.error(`Stopped — no progress made, ${remaining} days remain.`);
                    break;
                }

                setGenStatus(`Generating… ${remaining} days left`);
            }
        } finally {
            setGenerating(false);
            setGenStatus('');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Trivia Admin</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage which days are exposed to users</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                        {activeDaysCount} of {groups.length} days active
                    </Badge>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-60 transition-colors"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {generating ? (genStatus || 'Generating...') : 'Generate Questions'}
                    </button>
                </div>
            </div>

            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                <div className="w-10 shrink-0">Day</div>
                <div className="w-32 shrink-0">Date</div>
                <div className="flex-1">Theme</div>
                <div className="w-12 shrink-0 text-center">Qs</div>
                <div className="w-16 shrink-0 text-center">Active</div>
                <div className="w-8 shrink-0"></div>
            </div>

            {/* Rows */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">No trivia questions found.</div>
            ) : (
                groups.map(group => (
                    <DayRow
                        key={group.dayNumber}
                        group={group}
                        onToggle={handleToggle}
                    />
                ))
            )}
        </div>
    );
}