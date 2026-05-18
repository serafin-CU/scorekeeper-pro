import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Trash2, CheckCircle, XCircle } from 'lucide-react';

const CONFIRM_PHRASE = 'WIPE_UNITYCUP_PHASE2';

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

export default function AdminWipeData() {
    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const [showModal, setShowModal] = useState(false);
    const [confirmInput, setConfirmInput] = useState('');
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);
    const [counts, setCounts] = useState(null);
    const [log, setLog] = useState([]);
    const logRef = useRef(null);

    const addLog = (msg) => {
        setLog(prev => {
            const next = [...prev, { time: new Date().toISOString(), msg }];
            return next;
        });
        setTimeout(() => {
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        }, 50);
    };

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

    const handleConfirmWipe = async () => {
        if (confirmInput !== CONFIRM_PHRASE) return;
        setShowModal(false);
        setRunning(true);
        setDone(false);
        setError(null);
        setCounts(null);
        setLog([]);

        addLog('🚨 Starting full tournament data wipe...');
        addLog(`Entities to wipe (in order): ${ENTITIES_IN_ORDER.join(', ')}`);

        try {
            addLog('⏳ Sending wipe request to backend... (this may take several minutes)');
            const res = await base44.functions.invoke('wipeData', { action: 'wipe_all' });
            const data = res.data;

            if (data.error) {
                throw new Error(data.error);
            }

            setCounts(data.counts);

            for (const [entity, count] of Object.entries(data.counts || {})) {
                addLog(`✅ ${entity}: ${count} records deleted`);
            }

            const total = Object.values(data.counts || {}).reduce((a, b) => a + b, 0);
            addLog(`🏁 Wipe complete. Total records deleted: ${total}`);
            addLog('📋 Audit log entry created in AdminAuditLog.');
            setDone(true);
        } catch (err) {
            setError(err.message);
            addLog(`❌ Error: ${err.message}`);
        } finally {
            setRunning(false);
        }
    };

    const phraseMatch = confirmInput === CONFIRM_PHRASE;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Wipe Tournament Data</h1>
                    </div>
                    <p className="text-sm text-gray-500">
                        Permanently deletes all tournament data. User data (predictions, fantasy squads, points) is preserved.
                    </p>
                </div>

                {/* Warning card */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
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

                {/* Big red button */}
                {!running && !done && (
                    <Button
                        onClick={() => { setConfirmInput(''); setShowModal(true); }}
                        className="w-full h-16 text-lg font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg"
                    >
                        <Trash2 className="w-6 h-6 mr-3" />
                        WIPE ALL TOURNAMENT DATA
                    </Button>
                )}

                {running && (
                    <div className="w-full h-16 flex items-center justify-center bg-red-100 border-2 border-red-300 rounded-xl text-red-700 font-semibold text-base gap-3">
                        <div className="w-5 h-5 border-3 border-red-400 border-t-red-700 rounded-full animate-spin" />
                        Wiping data... please wait
                    </div>
                )}

                {done && !error && (
                    <div className="w-full h-16 flex items-center justify-center bg-green-50 border-2 border-green-300 rounded-xl text-green-700 font-semibold text-base gap-3">
                        <CheckCircle className="w-5 h-5" />
                        Wipe complete
                    </div>
                )}

                {error && (
                    <div className="w-full px-6 py-4 flex items-center bg-red-50 border-2 border-red-300 rounded-xl text-red-700 font-semibold text-sm gap-3">
                        <XCircle className="w-5 h-5 shrink-0" />
                        Error: {error}
                    </div>
                )}

                {/* Live log */}
                {log.length > 0 && (
                    <div className="mt-6">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Progress Log</p>
                        <div
                            ref={logRef}
                            className="bg-gray-900 rounded-xl p-4 text-xs text-green-400 font-mono overflow-y-auto"
                            style={{ maxHeight: '320px' }}
                        >
                            {log.map((entry, i) => (
                                <div key={i} className="mb-0.5">
                                    <span className="text-gray-600 mr-2">{entry.time.substring(11, 19)}</span>
                                    <span>{entry.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Counts summary */}
                {counts && (
                    <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Records Deleted</p>
                        <div className="space-y-1">
                            {Object.entries(counts).map(([entity, count]) => (
                                <div key={entity} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{entity}</span>
                                    <span className="font-semibold text-gray-900">{count}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-sm pt-2 border-t border-gray-100 mt-2">
                                <span className="font-semibold text-gray-700">Total</span>
                                <span className="font-bold text-gray-900">
                                    {Object.values(counts).reduce((a, b) => a + b, 0)}
                                </span>
                            </div>
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
                            This will <strong>permanently delete</strong> all tournament data (teams, matches, players, results, etc.). This action cannot be undone.
                        </p>
                        <p className="text-sm text-gray-700">
                            To confirm, type exactly:
                        </p>
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