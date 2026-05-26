import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

// Parse source_note like "Day 1 — May 27, 2026 — Pre-Kickoff — Welcome to UnityCup — ..."
function parseSourceNote(sourceNote) {
    if (!sourceNote) return { dayNumber: null, date: null, theme: null };
    const parts = sourceNote.split('—').map(s => s.trim());
    const dayMatch = parts[0]?.match(/Day\s+(\d+)/i);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : null;
    const date = parts[1] || null;
    const theme = parts[3] || parts[2] || null;
    return { dayNumber, date, theme };
}

function groupQuestionsByDay(questions) {
    const map = {};
    for (const q of questions) {
        const { dayNumber, date, theme } = parseSourceNote(q.source_note);
        const key = dayNumber ?? 'unknown';
        if (!map[key]) {
            map[key] = { dayNumber: key, date, theme, questions: [] };
        }
        map[key].questions.push(q);
    }
    return Object.values(map).sort((a, b) => {
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

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Trivia Admin</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage which days are exposed to users</p>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1 mt-1">
                    {activeDaysCount} of {groups.length} days active
                </Badge>
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