import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Trash2, CheckCircle, XCircle, Pause, Play, Loader2 } from 'lucide-react';

const CONFIRM_PHRASE = 'WIPE_UNITYCUP_PHASE2';
const BATCH_SIZE = 25;

const ENTITIES_IN_ORDER = [
    'FantasyMatchPlayerStats',
    'MatchResultFinal',
    'MatchValidation',
    'MatchSourceLink',
    'IngestionEvent',
    'IngestionRun',
    'DataSource',
    'Player',
    'Match',
    'Team',
];

function fmt(iso) { return iso ? iso.substring(11, 19) : ''; }

export default function AdminWipeData() {
    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [confirmInput, setConfirmInput] = useState('');

    // Pre-wipe counts
    const [preCounts, setPreCounts] = useState(null);
    const [countLoading, setCountLoading] = useState(false);

    // Run state
    const [phase, setPhase] = useState('idle'); // idle | counting | running | paused | done | error
    const [log, setLog] = useState([]);
    const [entityRemaining, setEntityRemaining] = useState({});
    const [cumulativeDeleted, setCumulativeDeleted] = useState({});
    const [totalDeleted, setTotalDeleted] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [startTime, setStartTime] = useState(null);

    const logRef = useRef(null);
    const pausedRef = useRef(false);
    const consecutiveErrors = useRef(0);
    const cumulativeRef = useRef({});

    const addLog = useCallback((msg) => {
        const time = new Date().toISOString();
        setLog(prev => [...prev, { time, msg }]);
        setTimeout(() => {
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        }, 30);
    }, []);

    // ── Pre-query counts ──────────────────────────────────────────────────────
    const fetchCounts = async () => {
        setCountLoading(true);
        try {
            const res = await base44.functions.invoke('wipeData', { action: 'count_all' });
            const data = res.data;
            if (data.error) throw new Error(data.error);
            setPreCounts(data.counts);
            // Seed entityRemaining
            setEntityRemaining({ ...data.counts });
            return data.counts;
        } finally {
            setCountLoading(false);
        }
    };

    // ── Open modal → fetch counts first ──────────────────────────────────────
    const handleOpenModal = async () => {
        setConfirmInput('');
        setPhase('counting');
        const counts = await fetchCounts();
        setPhase('idle');
        setShowModal(true);
    };

    // ── Main wipe loop ────────────────────────────────────────────────────────
    const runWipeLoop = useCallback(async () => {
        pausedRef.current = false;
        consecutiveErrors.current = 0;
        const t0 = Date.now();
        setStartTime(t0);
        setPhase('running');
        addLog('🚨 Wipe started. Looping over entities...');

        while (true) {
            if (pausedRef.current) {
                setPhase('paused');
                return;
            }

            let res;
            try {
                const r = await base44.functions.invoke('wipeData', {
                    confirmation: CONFIRM_PHRASE,
                    batch_size: BATCH_SIZE,
                    cumulative_deleted: cumulativeRef.current,
                });
                res = r.data;
                if (res.error) throw new Error(res.error);
                consecutiveErrors.current = 0;
            } catch (err) {
                consecutiveErrors.current++;
                addLog(`⚠️ Error (attempt ${consecutiveErrors.current}/5): ${err.message}`);
                if (consecutiveErrors.current >= 5) {
                    setErrorMsg(`Too many consecutive errors: ${err.message}`);
                    setPhase('error');
                    return;
                }
                addLog('   Retrying in 5s...');
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            // Update cumulative
            cumulativeRef.current = res.cumulative_deleted || cumulativeRef.current;
            setCumulativeDeleted({ ...cumulativeRef.current });
            const tot = Object.values(cumulativeRef.current).reduce((a, b) => a + b, 0);
            setTotalDeleted(tot);
            setElapsedMs(Date.now() - t0);

            // Update per-entity remaining
            if (res.entity_processed) {
                setEntityRemaining(prev => {
                    const next = { ...prev };
                    // Decrement by what was deleted
                    next[res.entity_processed] = Math.max(0, (next[res.entity_processed] || 0) - (res.deleted_in_this_call || 0));
                    return next;
                });
                const time = fmt(new Date().toISOString());
                addLog(`[${time}] ${res.entity_processed}: deleted ${res.deleted_in_this_call}, remaining ~${Math.max(0, (entityRemaining[res.entity_processed] || 0) - (res.deleted_in_this_call || 0))}`);
            }

            if (res.all_done) {
                setPhase('done');
                setElapsedMs(Date.now() - t0);
                addLog(`🏁 All done! Total deleted: ${tot}. Audit log written.`);
                return;
            }
        }
    }, [addLog]);

    const handleConfirmWipe = async () => {
        if (confirmInput !== CONFIRM_PHRASE) return;
        setShowModal(false);
        setLog([]);
        setCumulativeDeleted({});
        cumulativeRef.current = {};
        setTotalDeleted(0);
        setErrorMsg(null);
        // Seed remaining from pre-counts
        if (preCounts) setEntityRemaining({ ...preCounts });
        await runWipeLoop();
    };

    const handleResume = async () => {
        pausedRef.current = false;
        setErrorMsg(null);
        await runWipeLoop();
    };

    const handlePause = () => {
        pausedRef.current = true;
    };

    const phraseMatch = confirmInput === CONFIRM_PHRASE;
    const isRunning = phase === 'running';
    const isPaused = phase === 'paused';
    const isDone = phase === 'done';
    const isError = phase === 'error';
    const totalInitial = preCounts ? Object.values(preCounts).reduce((a, b) => a + b, 0) : 0;

    if (userLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
            </div>
        );
    }

    if (currentUser?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
                    <p className="text-gray-500 mt-2">Admin access required.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto space-y-5">

                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Wipe Tournament Data</h1>
                    </div>
                    <p className="text-sm text-gray-500">Permanently deletes all tournament data. User data is preserved.</p>
                </div>

                {/* Warning card */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-800 mb-2">This will permanently delete:</p>
                            <ul className="text-sm text-red-700 space-y-0.5 list-disc ml-4">
                                {ENTITIES_IN_ORDER.map(e => <li key={e}>{e}</li>)}
                            </ul>
                            <p className="font-semibold text-red-800 mt-3 mb-1">Will NOT delete:</p>
                            <p className="text-sm text-red-700">AppConfig, Users, ProdePrediction, FantasySquad, FantasySquadPlayer, PointsLedger, FantasyTransferPenalty, BadgeAward, ScoringJob, AdminAuditLog</p>
                        </div>
                    </div>
                </div>

                {/* Big red button — idle only */}
                {(phase === 'idle' || phase === 'counting') && (
                    <Button
                        onClick={handleOpenModal}
                        disabled={phase === 'counting'}
                        className="w-full h-16 text-lg font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg disabled:opacity-60"
                    >
                        {phase === 'counting'
                            ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Counting records...</>
                            : <><Trash2 className="w-6 h-6 mr-3" /> WIPE ALL TOURNAMENT DATA</>
                        }
                    </Button>
                )}

                {/* Running status bar */}
                {(isRunning || isPaused || isDone || isError) && (
                    <div>
                        {/* Total deleted counter */}
                        <div className={`rounded-xl p-5 border-2 mb-4 ${isDone ? 'bg-green-50 border-green-300' : isError ? 'bg-red-50 border-red-300' : isPaused ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-gray-900">{totalDeleted.toLocaleString()}</div>
                                    <div className="text-sm text-gray-500">records deleted{totalInitial > 0 ? ` of ~${totalInitial.toLocaleString()}` : ''}</div>
                                    {elapsedMs > 0 && <div className="text-xs text-gray-400 mt-0.5">Elapsed: {(elapsedMs / 1000).toFixed(1)}s</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isRunning && (
                                        <Button variant="outline" size="sm" onClick={handlePause} className="gap-1.5">
                                            <Pause className="w-4 h-4" /> Pause
                                        </Button>
                                    )}
                                    {(isPaused || isError) && (
                                        <Button size="sm" onClick={handleResume} className="gap-1.5 bg-gray-800 text-white hover:bg-gray-700">
                                            <Play className="w-4 h-4" /> Resume
                                        </Button>
                                    )}
                                    {isDone && <CheckCircle className="w-8 h-8 text-green-500" />}
                                    {isRunning && <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />}
                                </div>
                            </div>
                            {isDone && <p className="text-green-700 font-semibold mt-2">✓ Wipe complete — audit log written.</p>}
                            {isPaused && <p className="text-yellow-700 font-semibold mt-2">⏸ Paused. Press Resume to continue.</p>}
                            {isError && <p className="text-red-700 font-semibold mt-2">❌ {errorMsg}</p>}
                        </div>

                        {/* Per-entity status */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Entity Progress</p>
                            <div className="space-y-1.5">
                                {ENTITIES_IN_ORDER.map(e => {
                                    const initial = preCounts?.[e] ?? 0;
                                    const remaining = entityRemaining[e] ?? initial;
                                    const deleted = cumulativeDeleted[e] || 0;
                                    const done = remaining === 0 && (deleted > 0 || initial === 0);
                                    const inProgress = remaining > 0 && deleted > 0;
                                    return (
                                        <div key={e} className="flex items-center justify-between text-sm">
                                            <span className={done ? 'text-green-600 font-medium' : inProgress ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                                                {done ? '✓ ' : inProgress ? '⟳ ' : '· '}{e}
                                            </span>
                                            <span className={`text-xs font-mono ${done ? 'text-green-500' : inProgress ? 'text-yellow-600' : 'text-gray-300'}`}>
                                                {done ? `done (${deleted})` : initial > 0 ? `${remaining} left` : 'empty'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Live log */}
                {log.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Progress Log</p>
                        <div
                            ref={logRef}
                            className="bg-gray-900 rounded-xl p-4 text-xs text-green-400 font-mono overflow-y-auto"
                            style={{ maxHeight: '280px' }}
                        >
                            {log.map((entry, i) => (
                                <div key={i} className="mb-0.5">
                                    <span className="text-gray-600 mr-2">{fmt(entry.time)}</span>
                                    <span>{entry.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Data Wipe
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-700">
                            This will <strong>permanently delete</strong> all tournament data. This action cannot be undone.
                        </p>
                        {preCounts && (
                            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                                <p className="font-semibold text-gray-600 mb-2">Records to be deleted:</p>
                                {ENTITIES_IN_ORDER.map(e => (
                                    <div key={e} className="flex justify-between">
                                        <span className="text-gray-500">{e}</span>
                                        <span className="font-mono font-semibold text-gray-700">{(preCounts[e] || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                                    <span className="font-semibold text-gray-600">Total</span>
                                    <span className="font-mono font-bold text-red-600">
                                        {Object.values(preCounts).reduce((a, b) => a + b, 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                        <p className="text-sm text-gray-700">Type exactly to confirm:</p>
                        <code className="block text-center text-sm font-bold bg-gray-100 py-2 px-4 rounded text-red-700 tracking-wide select-all">
                            {CONFIRM_PHRASE}
                        </code>
                        <Input
                            value={confirmInput}
                            onChange={e => setConfirmInput(e.target.value)}
                            placeholder="Type the confirmation phrase"
                            className={`font-mono text-sm ${phraseMatch ? 'border-green-400 ring-1 ring-green-300' : ''}`}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter' && phraseMatch) handleConfirmWipe(); }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button
                            onClick={handleConfirmWipe}
                            disabled={!phraseMatch}
                            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Wipe All Data
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}