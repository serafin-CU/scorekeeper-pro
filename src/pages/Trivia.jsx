import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Brain, CheckCircle2, XCircle, Loader2, ChevronRight, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import UnderReviewView from '@/components/trivia/UnderReviewView';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const TIMER_TOTAL_MS = 30000;

// Countdown ring component
function TimerRing({ remainingMs }) {
    const pct = remainingMs / TIMER_TOTAL_MS;
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - pct);
    const isLow = remainingMs <= 10000;
    const seconds = Math.ceil(remainingMs / 1000);

    return (
        <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="64" height="64">
                <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                    cx="32" cy="32" r={radius} fill="none"
                    stroke={isLow ? '#ef4444' : CU.orange}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
                />
            </svg>
            <span style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.1rem',
                color: isLow ? '#ef4444' : CU.charcoal,
                fontWeight: 700
            }}>{seconds}</span>
        </div>
    );
}

// Progress dots
function ProgressDots({ current, total }) {
    return (
        <div className="flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                        width: i === current ? '24px' : '8px',
                        height: '8px',
                        background: i < current ? CU.orange : i === current ? CU.magenta : '#e5e7eb'
                    }}
                />
            ))}
        </div>
    );
}

export default function Trivia() {
    const [status, setStatus] = useState('LOADING_CHECK'); // LOADING_CHECK | ALREADY_DONE | ASSEMBLING | ANSWERING | GRADING | RESULT | ERROR
    const [questionIds, setQuestionIds] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [collectedAnswers, setCollectedAnswers] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(null);  // current question pending selection
    const [confirming, setConfirming] = useState(false);        // 300ms highlight before advance
    const [feedbackCorrect, setFeedbackCorrect] = useState(null); // null = none, true = correct, false = wrong
    const [remainingMs, setRemainingMs] = useState(TIMER_TOTAL_MS);
    const [result, setResult] = useState(null);
    const [existingAttempt, setExistingAttempt] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const answeredRef = useRef(false); // prevent double-advance on click + timer

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const UNDER_REVIEW = true; // toggle off to re-enable Trivia for everyone
    const isAdmin = currentUser?.role === 'admin';

    const today = new Date().toISOString().slice(0, 10);

    // On mount: check if user already has an attempt today
    useEffect(() => {
        if (!currentUser) return;
        checkExistingAttempt();
    }, [currentUser]);

    async function checkExistingAttempt() {
        setStatus('LOADING_CHECK');
        const attempts = await base44.entities.TriviaAttempt.filter({
            user_id: currentUser.id,
            daily_set_date: today
        });
        if (attempts.length > 0) {
            // Load full question details for the breakdown display
            const set = await base44.entities.TriviaDailySet.filter({ date: today });
            if (set.length > 0) {
                const results = await Promise.all(set[0].question_ids.map(qid => base44.entities.TriviaQuestion.filter({ id: qid })));
                const qs = results.map(rows => rows[0]).filter(Boolean);
                setQuestions(qs);
            }
            setExistingAttempt(attempts[0]);
            setStatus('ALREADY_DONE');
        } else {
            setStatus('IDLE'); // ready to start
        }
    }

    async function handleStart() {
        setStatus('ASSEMBLING');
        try {
            const res = await base44.functions.invoke('assembleDailyTrivia', { date: today });
            const ids = res.data?.question_ids;
            if (!ids || ids.length !== 5) {
                setErrorMsg(res.data?.error || 'Could not load today\'s questions. Please try again later.');
                setStatus('ERROR');
                return;
            }
            setQuestionIds(ids);

            // Fetch question details
            const results = await Promise.all(ids.map(qid => base44.entities.TriviaQuestion.filter({ id: qid })));
            const qs = results.map(rows => rows[0]).filter(Boolean);
            setQuestions(qs);
            setCurrentQIndex(0);
            setCollectedAnswers([]);
            answeredRef.current = false;
            setStatus('ANSWERING');
        } catch (err) {
            console.error('[Trivia] assembleDailyTrivia failed:', err);
            setErrorMsg(err?.message || 'Could not load today\'s questions. Please try again later.');
            setStatus('ERROR');
        }
    }

    // Timer tick while ANSWERING
    useEffect(() => {
        if (status !== 'ANSWERING') return;
        answeredRef.current = false;
        setSelectedIndex(null);
        setConfirming(false);
        setFeedbackCorrect(null);
        setRemainingMs(TIMER_TOTAL_MS);
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = TIMER_TOTAL_MS - elapsed;
            if (remaining <= 0) {
                clearInterval(timerRef.current);
                setRemainingMs(0);
                handleAnswer(null, TIMER_TOTAL_MS + 1); // null = timeout
            } else {
                setRemainingMs(remaining);
            }
        }, 100);

        return () => clearInterval(timerRef.current);
    }, [status, currentQIndex]);

    function handleOptionClick(optionIndex) {
        if (confirming || answeredRef.current) return;
        clearInterval(timerRef.current);
        const responseTimeMs = Date.now() - startTimeRef.current;
        setSelectedIndex(optionIndex);
        setConfirming(true);
        setTimeout(() => handleAnswer(optionIndex, responseTimeMs), 300);
    }

    function handleAnswer(optionIndex, responseTimeMs) {
        if (answeredRef.current) return;
        answeredRef.current = true;
        clearInterval(timerRef.current);

        const answer = {
            question_id:      questions[currentQIndex].id,
            selected_index:   optionIndex,
            response_time_ms: Math.min(Math.round(responseTimeMs), TIMER_TOTAL_MS + 1000)
        };

        const newAnswers = [...collectedAnswers, answer];
        setCollectedAnswers(newAnswers);

        // Instant correct/wrong feedback for 1200ms before advancing
        const isCorrect = optionIndex === questions[currentQIndex].correct_answer_index;
        setFeedbackCorrect(isCorrect);

        const isLast = currentQIndex >= questions.length - 1;
        setTimeout(() => {
            setFeedbackCorrect(null);
            if (isLast) {
                submitAttempt(newAnswers);
            } else {
                setCurrentQIndex(prev => prev + 1);
                // status stays ANSWERING, useEffect re-fires on currentQIndex change
            }
        }, 1200);
    }

    async function submitAttempt(answers) {
        setStatus('GRADING');
        const res = await base44.functions.invoke('gradeTriviaAttempt', {
            date: today,
            answers
        });
        if (!res.data?.ok) {
            if (res.data?.already_attempted) {
                // Race — another tab submitted first; treat as done
                await checkExistingAttempt();
                return;
            }
            setErrorMsg(res.data?.error || 'Grading failed. Please try again.');
            setStatus('ERROR');
            return;
        }
        setResult(res.data);
        setStatus('RESULT');
        if (res.data.correct_count >= 4) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        }
    }

    // ── RENDER ────────────────────────────────────────────────────────────────

    if (UNDER_REVIEW && !isAdmin) {
        return <UnderReviewView />;
    }

    if (status === 'LOADING_CHECK' || !currentUser) {
        return (
            <div className="max-w-xl mx-auto p-6 flex items-center justify-center min-h-64">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: CU.orange }} />
            </div>
        );
    }

    if (status === 'ALREADY_DONE' && existingAttempt) {
        return <AlreadyDoneView attempt={existingAttempt} questions={questions} />;
    }

    if (status === 'IDLE') {
        return <StartView onStart={handleStart} />;
    }

    if (status === 'ASSEMBLING') {
        return (
            <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center min-h-64 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: CU.orange }} />
                <p style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>Loading today's questions…</p>
            </div>
        );
    }

    if (status === 'ANSWERING' && questions[currentQIndex]) {
        const q = questions[currentQIndex];
        return (
            <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5" style={{ color: CU.magenta }} />
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: CU.charcoal }}>
                            Daily Trivia
                        </span>
                    </div>
                    <TimerRing remainingMs={remainingMs} />
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between">
                    <ProgressDots current={currentQIndex} total={5} />
                    <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af' }}>
                        Question {currentQIndex + 1} of 5
                    </span>
                </div>

                {/* Category chip */}
                <div>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: CU.orange + '20', color: CU.charcoal, fontFamily: "'Raleway', sans-serif", fontWeight: 600 }}>
                        {q.category?.replace(/_/g, ' ')}
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#f3f4f6', color: '#6b7280', fontFamily: "'Raleway', sans-serif" }}>
                        {q.difficulty}
                    </span>
                </div>

                {/* Question */}
                <p style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: '1.25rem',
                    color: CU.charcoal,
                    lineHeight: 1.4
                }}>
                    {q.question_text}
                </p>

                {/* Options */}
                <div className="space-y-2.5">
                    {q.options.map((opt, idx) => {
                        const isSelected = selectedIndex === idx && confirming;
                        return (
                            <button
                                key={idx}
                                onClick={() => handleOptionClick(idx)}
                                disabled={confirming || feedbackCorrect !== null}
                                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    background: isSelected ? CU.magenta : 'white',
                                    color: isSelected ? 'white' : CU.charcoal,
                                    border: isSelected ? `1.5px solid ${CU.magenta}` : '1.5px solid #e5e7eb',
                                    cursor: confirming ? 'default' : 'pointer',
                                    boxShadow: isSelected ? `0 2px 12px ${CU.magenta}30` : '0 1px 3px rgba(0,0,0,0.06)'
                                }}
                            >
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                      style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : '#f3f4f6', color: isSelected ? 'white' : '#6b7280' }}>
                                    {OPTION_LABELS[idx]}
                                </span>
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* Instant feedback banner */}
                {feedbackCorrect !== null && (
                    <div
                        className="flex items-center gap-2 px-4 py-3 rounded-xl"
                        style={{
                            background: feedbackCorrect ? '#f0fdf4' : '#fef2f2',
                            border: `1.5px solid ${feedbackCorrect ? '#bbf7d0' : '#fecaca'}`,
                            fontFamily: "'Raleway', sans-serif",
                            fontWeight: 600,
                            color: feedbackCorrect ? '#16a34a' : '#dc2626',
                            animation: 'dashFadeSlideUp 0.3s ease forwards'
                        }}
                    >
                        {feedbackCorrect ? (
                            <><CheckCircle2 className="w-5 h-5" /> Correct!</>
                        ) : (
                            <><XCircle className="w-5 h-5" /> Wrong — correct answer was {OPTION_LABELS[q.correct_answer_index]}</>
                        )}
                    </div>
                )}

                <p className="text-center text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    5 questions · 30s each · faster = more points
                </p>
            </div>
        );
    }

    if (status === 'GRADING') {
        return (
            <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center min-h-64 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: CU.orange }} />
                <p style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>Calculating your score…</p>
            </div>
        );
    }

    if (status === 'RESULT' && result) {
        return <ResultView result={result} questions={questions} />;
    }

    if (status === 'ERROR') {
        return (
            <div className="max-w-xl mx-auto p-6 space-y-4 text-center">
                <p style={{ fontFamily: "'Raleway', sans-serif", color: '#ef4444' }}>{errorMsg}</p>
                <button
                    onClick={() => { setStatus('IDLE'); setErrorMsg(''); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: CU.orange, color: 'white', fontFamily: "'Raleway', sans-serif" }}>
                    Try Again
                </button>
            </div>
        );
    }

    return null;
}

// ── Sub-views ──────────────────────────────────────────────────────────────────

function StartView({ onStart }) {
    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.magenta }}>
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: '#2C2B2B', margin: 0 }}>
                        Daily Trivia
                    </h1>
                    <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                        5 questions · 30s each · faster = more points
                    </p>
                </div>
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                        { label: 'Questions', value: '5' },
                        { label: 'Max points', value: '100' },
                        { label: 'Timer', value: '30s' }
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl p-3" style={{ background: '#f9fafb' }}>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', color: '#2C2B2B' }}>{value}</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.7rem', color: '#9ca3af' }}>{label}</div>
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    {[
                        '⚡ Answer faster to earn more points per question',
                        '✅ 5 correct → 100 pts max   |   speed earns up to 20 pts/question',
                        '🔒 One attempt per day — no re-dos'
                    ].map(tip => (
                        <p key={tip} className="text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>{tip}</p>
                    ))}
                </div>
            </div>

            <button
                onClick={onStart}
                className="w-full py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: CU.magenta, color: 'white', fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem' }}>
                Start Today's Trivia
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}

function AlreadyDoneView({ attempt, questions }) {
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.magenta }}>
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: '#2C2B2B', margin: 0 }}>
                    Daily Trivia
                </h1>
            </div>

            <div className="rounded-2xl p-5 text-center space-y-1" style={{ background: CU.orange + '15', border: `1px solid ${CU.orange}40` }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: '#2C2B2B' }}>
                    {attempt.correct_count}/5
                </div>
                <div style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280', fontSize: '0.875rem' }}>correct answers</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', color: CU.magenta }}>
                    +{attempt.total_points} pts
                </div>
                <p className="text-xs pt-1" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    Come back tomorrow for a new set! 🌟
                </p>
            </div>

            <BreakdownList answers={attempt.answers} qMap={qMap} />

            <Link to="/Leaderboard?tab=trivia">
                <button className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2"
                        style={{ background: '#f3f4f6', color: '#2C2B2B', fontFamily: "'Raleway', sans-serif" }}>
                    <Trophy className="w-4 h-4" style={{ color: CU.orange }} />
                    See Trivia Leaderboard
                </button>
            </Link>
        </div>
    );
}

function ResultView({ result, questions }) {
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.magenta }}>
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: '#2C2B2B', margin: 0 }}>
                    Results
                </h1>
            </div>

            <div className="rounded-2xl p-5 text-center space-y-1" style={{ background: CU.orange + '15', border: `1px solid ${CU.orange}40` }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: '#2C2B2B' }}>
                    {result.correct_count}/5
                </div>
                <div style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280', fontSize: '0.875rem' }}>correct answers</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', color: CU.magenta }}>
                    +{result.total_points} pts earned
                </div>
            </div>

            <BreakdownList answers={result.breakdown} qMap={qMap} />

            <p className="text-center text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                Come back tomorrow for a new set! 🌟
            </p>

            <Link to="/Leaderboard?tab=trivia">
                <button className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: '#f3f4f6', color: '#2C2B2B', fontFamily: "'Raleway', sans-serif" }}>
                    <Trophy className="w-4 h-4" style={{ color: CU.orange }} />
                    See Trivia Leaderboard
                </button>
            </Link>
        </div>
    );
}

function BreakdownList({ answers, qMap }) {
    return (
        <div className="space-y-2">
            {answers.map((a, idx) => {
                const q = qMap[a.question_id];
                return (
                    <div key={idx} className="rounded-xl p-3 flex items-start gap-3"
                         style={{ background: a.is_correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${a.is_correct ? '#bbf7d0' : '#fecaca'}` }}>
                        <div className="mt-0.5 flex-shrink-0">
                            {a.is_correct
                                ? <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                                : <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: '#1f2937' }}>
                                {q?.question_text || `Question ${idx + 1}`}
                            </p>
                            {!a.is_correct && q && a.selected_index !== null && (
                                <p className="text-xs mt-0.5" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                                    Your answer: {q.options[a.selected_index]}
                                </p>
                            )}
                            {!a.is_correct && q && (
                                <p className="text-xs mt-0.5 font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: '#22c55e' }}>
                                    Correct: {q.options[q.correct_answer_index]}
                                </p>
                            )}
                        </div>
                        <div className="text-xs font-bold flex-shrink-0" style={{
                            fontFamily: "'DM Serif Display', serif",
                            color: a.points_earned > 0 ? CU.magenta : '#9ca3af'
                        }}>
                            +{a.points_earned}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}