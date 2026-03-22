import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, CheckCircle2, Lock, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PHASES = [
    'GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3',
    'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'
];

const PHASE_LABELS = {
    GROUP_MD1: 'Group MD1', GROUP_MD2: 'Group MD2', GROUP_MD3: 'Group MD3',
    ROUND_OF_32: 'Round of 32', ROUND_OF_16: 'Round of 16',
    QUARTERFINALS: 'Quarterfinals', SEMIFINALS: 'Semifinals', FINAL: 'Final'
};

export default function ProdePredictions() {
    const [selectedPhase, setSelectedPhase] = useState(null);
    const [predictions, setPredictions] = useState({}); // match_id -> { home, away }
    const [serverPreds, setServerPreds] = useState({}); // match_id -> { pred_home_goals, pred_away_goals }
    const [submitting, setSubmitting] = useState({}); // match_id -> bool
    const [predsLoaded, setPredsLoaded] = useState(false);

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    // Load existing predictions once
    useEffect(() => {
        if (predsLoaded) return;
        base44.functions.invoke('prodeService', { action: 'get_user_predictions' })
            .then(res => {
                const preds = res.data?.predictions || [];
                const map = {};
                preds.forEach(p => { map[p.match_id] = p; });
                setServerPreds(map);
                // Pre-fill inputs from server
                const inputMap = {};
                preds.forEach(p => {
                    inputMap[p.match_id] = {
                        home: String(p.pred_home_goals ?? ''),
                        away: String(p.pred_away_goals ?? '')
                    };
                });
                setPredictions(inputMap);
                setPredsLoaded(true);
            })
            .catch(() => setPredsLoaded(true));
    }, [predsLoaded]);

    // Determine phases that have matches
    const phasesWithMatches = PHASES.filter(p => matches.some(m => m.phase === p));

    // Auto-select first phase with upcoming matches
    useEffect(() => {
        if (!selectedPhase && phasesWithMatches.length > 0) {
            const now = new Date();
            const phaseWithUpcoming = phasesWithMatches.find(p =>
                matches.some(m => m.phase === p && new Date(m.kickoff_at) > now)
            );
            setSelectedPhase(phaseWithUpcoming || phasesWithMatches[0]);
        }
    }, [phasesWithMatches.length]);

    const matchesInPhase = matches
        .filter(m => m.phase === selectedPhase)
        .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));

    const now = new Date();

    const isLocked = (match) => new Date(match.kickoff_at) <= now;

    const totalMatches = matches.length;
    const predictedCount = Object.keys(serverPreds).length;
    const toGo = totalMatches - predictedCount;

    const phaseStats = (phase) => {
        const phaseMatches = matches.filter(m => m.phase === phase);
        const phasePredicted = phaseMatches.filter(m => serverPreds[m.id]).length;
        return `${phasePredicted}/${phaseMatches.length}`;
    };

    const getDraft = (matchId) => predictions[matchId] || { home: '', away: '' };

    const setDraft = (matchId, key, val) => {
        // Only allow non-negative integers
        if (val !== '' && !/^\d+$/.test(val)) return;
        setPredictions(prev => ({
            ...prev,
            [matchId]: { ...getDraft(matchId), [key]: val }
        }));
    };

    const isDirty = (matchId) => {
        const draft = getDraft(matchId);
        const server = serverPreds[matchId];
        if (draft.home === '' || draft.away === '') return false;
        if (!server) return true;
        return (
            parseInt(draft.home) !== server.pred_home_goals ||
            parseInt(draft.away) !== server.pred_away_goals
        );
    };

    const handleSubmit = async (match) => {
        const draft = getDraft(match.id);
        if (draft.home === '' || draft.away === '') {
            toast.error('Please enter both home and away goals');
            return;
        }
        setSubmitting(prev => ({ ...prev, [match.id]: true }));
        try {
            await base44.functions.invoke('prodeService', {
                action: 'submit_prediction',
                match_id: match.id,
                pred_home_goals: parseInt(draft.home),
                pred_away_goals: parseInt(draft.away)
            });
            setServerPreds(prev => ({
                ...prev,
                [match.id]: {
                    ...prev[match.id],
                    match_id: match.id,
                    pred_home_goals: parseInt(draft.home),
                    pred_away_goals: parseInt(draft.away)
                }
            }));
            toast.success('Prediction saved!');
        } catch (err) {
            toast.error(err.message || 'Failed to save prediction');
        }
        setSubmitting(prev => ({ ...prev, [match.id]: false }));
    };

    const getTimeRemaining = (match) => {
        const diff = new Date(match.kickoff_at) - now;
        if (diff <= 0) return null;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hours >= 48) return `${Math.floor(hours / 24)}d remaining`;
        if (hours >= 1) return `${hours}h ${mins}m remaining`;
        return `${mins}m remaining`;
    };

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="w-7 h-7 text-yellow-500" />
                    Prode Predictions
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Exact score = 5 pts · Correct winner = 3 pts · Correct MVP = 2 pts
                </p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{predictedCount}</div>
                        <div className="text-xs text-gray-500">Predicted</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                        <div className="text-2xl font-bold text-orange-500">{toGo}</div>
                        <div className="text-xs text-gray-500">To go</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                        <div className="text-2xl font-bold">{totalMatches}</div>
                        <div className="text-xs text-gray-500">Total</div>
                    </CardContent>
                </Card>
            </div>

            {/* Phase selector */}
            {phasesWithMatches.length > 0 && (
                <div className="mb-6">
                    <Select value={selectedPhase || ''} onValueChange={setSelectedPhase}>
                        <SelectTrigger className="w-full sm:w-72">
                            <SelectValue placeholder="Select phase" />
                        </SelectTrigger>
                        <SelectContent>
                            {phasesWithMatches.map(p => (
                                <SelectItem key={p} value={p}>
                                    {PHASE_LABELS[p]} ({phaseStats(p)})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Match cards */}
            <div className="space-y-3">
                {matchesInPhase.map(match => {
                    const home = teamsMap[match.home_team_id];
                    const away = teamsMap[match.away_team_id];
                    const locked = isLocked(match);
                    const server = serverPreds[match.id];
                    const draft = getDraft(match.id);
                    const dirty = !locked && isDirty(match.id);
                    const timeLeft = getTimeRemaining(match);
                    const isSubmitting = submitting[match.id];

                    return (
                        <Card key={match.id} className={`border ${locked ? 'bg-gray-50' : 'bg-white'}`}>
                            <CardContent className="pt-4 pb-4">
                                {/* Date + status row */}
                                <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                                    <span>
                                        {new Date(match.kickoff_at).toLocaleString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {server && (
                                            <span className="flex items-center gap-1 text-green-600 font-medium">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Predicted
                                            </span>
                                        )}
                                        {locked ? (
                                            <span className="flex items-center gap-1 text-gray-400">
                                                <Lock className="w-3.5 h-3.5" />
                                                Locked
                                            </span>
                                        ) : timeLeft ? (
                                            <span className="flex items-center gap-1 text-blue-500">
                                                <Clock className="w-3.5 h-3.5" />
                                                {timeLeft}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Teams + score inputs */}
                                <div className="flex items-center gap-3">
                                    {/* Home team */}
                                    <div className="flex-1 text-right">
                                        <div className="font-bold text-gray-900">{home?.name || '—'}</div>
                                        <div className="text-xs text-gray-400">{home?.fifa_code || ''}</div>
                                    </div>

                                    {/* Score inputs or read-only */}
                                    {locked ? (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100 text-xl font-bold text-gray-500">
                                                {server ? server.pred_home_goals : '—'}
                                            </div>
                                            <span className="text-gray-400 font-bold text-sm">vs</span>
                                            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100 text-xl font-bold text-gray-500">
                                                {server ? server.pred_away_goals : '—'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Input
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={draft.home}
                                                onChange={e => setDraft(match.id, 'home', e.target.value)}
                                                className="w-14 h-12 text-center text-xl font-bold p-1"
                                                placeholder="0"
                                            />
                                            <span className="text-gray-400 font-bold text-sm">vs</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={draft.away}
                                                onChange={e => setDraft(match.id, 'away', e.target.value)}
                                                className="w-14 h-12 text-center text-xl font-bold p-1"
                                                placeholder="0"
                                            />
                                        </div>
                                    )}

                                    {/* Away team */}
                                    <div className="flex-1 text-left">
                                        <div className="font-bold text-gray-900">{away?.name || '—'}</div>
                                        <div className="text-xs text-gray-400">{away?.fifa_code || ''}</div>
                                    </div>
                                </div>

                                {/* Submit button */}
                                {!locked && dirty && (
                                    <div className="mt-3 flex justify-center">
                                        <Button
                                            size="sm"
                                            onClick={() => handleSubmit(match)}
                                            disabled={isSubmitting}
                                            className="w-full sm:w-auto"
                                        >
                                            {isSubmitting ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                                            ) : server ? 'Update Prediction' : 'Submit Prediction'}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {matchesInPhase.length === 0 && selectedPhase && (
                    <div className="text-center py-12 text-gray-400">No matches in this phase</div>
                )}
                {!selectedPhase && phasesWithMatches.length === 0 && (
                    <div className="text-center py-12 text-gray-400">No matches available yet</div>
                )}
            </div>
        </div>
    );
}