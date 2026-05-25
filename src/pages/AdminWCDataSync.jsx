import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw, Users, Calendar, Trophy, Activity, Zap, BarChart3 } from 'lucide-react';

const CU = { orange: '#FFB81C', charcoal: '#2C2B2B' };

function StatusBadge({ status }) {
    if (status === 'FINAL') return <Badge className="bg-green-100 text-green-700">FINAL</Badge>;
    if (status === 'LIVE') return <Badge className="bg-red-100 text-red-700">LIVE</Badge>;
    return <Badge variant="outline">SCHEDULED</Badge>;
}

function ResultCard({ result, loading }) {
    if (!result) return null;
    const isError = !result.ok || result.error;
    return (
        <div className={`mt-4 p-4 rounded-lg border text-sm ${isError ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className={`flex items-center gap-2 font-semibold mb-2 ${isError ? 'text-red-700' : 'text-green-700'}`}>
                {isError ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {isError ? 'Error' : 'Success'}
            </div>
            <pre className="text-xs bg-white/60 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
            </pre>
        </div>
    );
}

function SyncCard({ title, description, icon: Icon, onSync, result, loading, buttonLabel = 'Sync Now', destructive = false, disabled = false }) {
    return (
        <Card className={disabled ? 'opacity-50' : ''}>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: CU.orange + '20' }}>
                        <Icon className="w-5 h-5" style={{ color: CU.orange }} />
                    </div>
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Button
                    onClick={onSync}
                    disabled={loading || disabled}
                    variant={destructive ? 'destructive' : 'default'}
                    className="w-full"
                    style={!destructive ? { background: disabled ? undefined : CU.charcoal } : {}}
                >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {loading ? 'Syncing...' : disabled ? '🔒 Disabled' : buttonLabel}
                </Button>
                <ResultCard result={result} loading={loading} />
            </CardContent>
        </Card>
    );
}

export default function AdminWCDataSync() {
    const queryClient = useQueryClient();
    const [loadingMap, setLoadingMap] = useState({});
    const [resultMap, setResultMap] = useState({});
    const [apiStatus, setApiStatus] = useState(null);
    const [apiStatusLoading, setApiStatusLoading] = useState(false);

    // Player sync loop state
    const [playerSyncing, setPlayerSyncing] = useState(false);
    const [playerProgress, setPlayerProgress] = useState(null); // { done, total, playersCreated, batchLog[], errors[] }
    const playerAbort = useRef(false);

    const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
    const { data: matches = [] } = useQuery({ queryKey: ['matches'], queryFn: () => base44.entities.Match.list() });
    const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list() });
    const { data: results = [] } = useQuery({ queryKey: ['matchResults'], queryFn: () => base44.entities.MatchResultFinal.list() });

    const setLoading = (key, val) => setLoadingMap(prev => ({ ...prev, [key]: val }));
    const setResult = (key, val) => setResultMap(prev => ({ ...prev, [key]: val }));

    const SYNC_INVALIDATIONS = {
        teams: ['teams'],
        fixtures: ['matches'],
        players: ['players'],
        results: ['matchResults', 'matches'],
    };

    const runAction = async (key, action, extra = {}) => {
        setLoading(key, true);
        setResult(key, null);
        try {
            const res = await base44.functions.invoke('wcDataSync', { action, ...extra });
            setResult(key, res.data);
            const toInvalidate = SYNC_INVALIDATIONS[key];
            if (toInvalidate && res.data?.ok !== false) {
                toInvalidate.forEach(qk => queryClient.invalidateQueries({ queryKey: [qk] }));
            }
        } catch (err) {
            setResult(key, { ok: false, error: err.message });
        }
        setLoading(key, false);
    };

    const checkApiStatus = async () => {
        setApiStatusLoading(true);
        try {
            const res = await base44.functions.invoke('wcDataSync', { action: 'status' });
            setApiStatus(res.data);
        } catch (err) {
            setApiStatus({ error: err.message });
        }
        setApiStatusLoading(false);
    };

    const finalizedCount = matches.filter(m => m.status === 'FINAL').length;
    const scheduledCount = matches.filter(m => m.status === 'SCHEDULED').length;

    const syncAllPlayers = async () => {
        playerAbort.current = false;
        setPlayerSyncing(true);
        setPlayerProgress({ done: 0, total: 0, playersCreated: 0, batchLog: [], errors: [] });

        let offset = 0;
        let totalTeams = 0;
        let totalPlayersCreated = 0;
        const allErrors = [];
        const batchLog = [];
        const BATCH_SIZE = 8;
        let apiTeamMap = {}; // cached after first batch to avoid redundant /teams API call

        try {
            while (true) {
                if (playerAbort.current) break;

                const res = await base44.functions.invoke('wcDataSync', {
                    action: 'sync_players',
                    offset,
                    batch_size: BATCH_SIZE,
                    ...(Object.keys(apiTeamMap).length > 0 ? { api_team_map: apiTeamMap } : {}),
                });
                const data = res.data;

                if (!data?.ok) {
                    allErrors.push(data?.error || 'Unknown error');
                    break;
                }

                totalTeams = data.total_teams || totalTeams;
                totalPlayersCreated += data.players_created || 0;
                if (data.api_team_map && Object.keys(data.api_team_map).length > 0) {
                    apiTeamMap = data.api_team_map; // cache for next batch
                }
                if (data.errors?.length) allErrors.push(...data.errors);

                batchLog.push({
                    offset,
                    teams: data.teams_in_batch,
                    players: data.players_created,
                    errors: data.errors?.length || 0,
                });

                setPlayerProgress({
                    done: offset + (data.teams_in_batch || BATCH_SIZE),
                    total: totalTeams,
                    playersCreated: totalPlayersCreated,
                    batchLog: [...batchLog],
                    errors: [...allErrors],
                });

                if (!data.has_more) break;

                offset = data.next_offset;
                // Brief pause between batches to avoid API rate limits
                await new Promise(r => setTimeout(r, 1200));
            }

            queryClient.invalidateQueries({ queryKey: ['players'] });
        } catch (err) {
            allErrors.push(err.message);
            setPlayerProgress(prev => ({ ...prev, errors: [...(prev?.errors || []), err.message] }));
        }

        setPlayerSyncing(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                            ⚽ WC 2026 Data Sync
                        </h1>
                        <Badge className="text-xs" style={{ background: CU.orange + '20', color: CU.charcoal }}>
                            API-Football · league=1 · season=2026
                        </Badge>
                    </div>
                    <p className="text-sm text-gray-500">Import real FIFA World Cup 2026 data into UnityCup</p>
                </div>

                {/* API Status */}
                <Card className="mb-6">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">API-Football Status</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={checkApiStatus} disabled={apiStatusLoading}>
                                {apiStatusLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                                Check API Status
                            </Button>
                        </div>
                        {apiStatus && (
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                {apiStatus.error ? (
                                    <div className="col-span-4 text-red-600">{apiStatus.error}</div>
                                ) : (
                                    <>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500">Plan</div>
                                            <div className="font-semibold">{apiStatus.subscription?.plan || '—'}</div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500">Active</div>
                                            <div className="font-semibold">{apiStatus.subscription?.active ? '✅ Yes' : '❌ No'}</div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500">Requests Today</div>
                                            <div className="font-semibold">{apiStatus.requests?.current ?? '—'}</div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500">Daily Limit</div>
                                            <div className="font-semibold">{apiStatus.requests?.limit_day ?? '—'}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Current DB Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Teams', value: teams.length, icon: '🏳️', target: 48 },
                        { label: 'Matches', value: matches.length, icon: '⚽', target: 104 },
                        { label: 'Players', value: players.length, icon: '👤', target: '~700' },
                        { label: 'Results', value: results.length, icon: '🏆', target: finalizedCount },
                    ].map(stat => (
                        <Card key={stat.label}>
                            <CardContent className="pt-4 pb-3">
                                <div className="text-2xl mb-1">{stat.icon}</div>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <div className="text-xs text-gray-500">{stat.label} <span className="text-gray-400">/ {stat.target}</span></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Match Status Breakdown */}
                {matches.length > 0 && (
                    <Card className="mb-6">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                                <span className="text-gray-500 font-medium">Match Status:</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> {finalizedCount} Final</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> {matches.filter(m => m.status === 'LIVE').length} Live</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span> {scheduledCount} Scheduled</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Sync Order Guide */}
                <Card className="mb-6 border-amber-200 bg-amber-50">
                    <CardContent className="pt-4 text-sm text-amber-800">
                        <strong>⚠️ Sync Order:</strong> Run in this order: <strong>1. Teams → 2. Fixtures → 3. Players → 4. Results</strong>. Each step depends on the previous one. Syncing replaces all existing data of that type.
                    </CardContent>
                </Card>

                {/* Sync Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SyncCard
                        title="1. Sync Teams"
                        description="Fetches all 48 qualified WC 2026 teams from API-Football. Replaces existing teams."
                        icon={Users}
                        onSync={() => runAction('teams', 'sync_teams')}
                        loading={loadingMap['teams']}
                        result={resultMap['teams']}
                        buttonLabel="Sync 48 Teams"
                        destructive
                    />
                    <SyncCard
                        title="2. Sync Fixtures"
                        description="Fetches all 104 WC 2026 matches. Requires teams to be synced first."
                        icon={Calendar}
                        onSync={() => runAction('fixtures', 'sync_fixtures')}
                        loading={loadingMap['fixtures']}
                        result={resultMap['fixtures']}
                        buttonLabel="Sync 104 Fixtures"
                        destructive
                    />
                    {/* Player Sync — auto-looping */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: CU.orange + '20' }}>
                                    <Zap className="w-5 h-5" style={{ color: CU.orange }} />
                                </div>
                                <div>
                                    <CardTitle className="text-base">3. Sync Players</CardTitle>
                                    <p className="text-xs text-gray-500 mt-0.5">Fetches squads + stats for all 48 teams in batches of 5. Runs automatically to completion.</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={playerSyncing ? () => { playerAbort.current = true; } : syncAllPlayers}
                                variant={playerSyncing ? 'outline' : 'destructive'}
                                className="w-full"
                            >
                                {playerSyncing
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Stop Sync</>
                                    : <><RefreshCw className="w-4 h-4 mr-2" />Sync All Player Squads + Stats</>
                                }
                            </Button>

                            {playerProgress && (
                                <div className="mt-4 space-y-3">
                                    {/* Progress bar */}
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>Teams processed: {Math.min(playerProgress.done, playerProgress.total || playerProgress.done)} / {playerProgress.total || '?'}</span>
                                            <span>{playerProgress.playersCreated} players created</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full transition-all duration-500"
                                                style={{
                                                    width: playerProgress.total ? `${Math.min(100, (playerProgress.done / playerProgress.total) * 100)}%` : '0%',
                                                    background: CU.orange
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Completion badge */}
                                    {!playerSyncing && playerProgress.done >= playerProgress.total && playerProgress.total > 0 && (
                                        <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                                            <CheckCircle className="w-4 h-4" /> All {playerProgress.total} teams synced — {playerProgress.playersCreated} players created
                                        </div>
                                    )}

                                    {/* Batch log */}
                                    {playerProgress.batchLog.length > 0 && (
                                        <div className="text-xs bg-gray-50 border rounded p-2 max-h-36 overflow-y-auto space-y-0.5">
                                            {playerProgress.batchLog.map((b, i) => (
                                                <div key={i} className="flex justify-between text-gray-600">
                                                    <span>Batch {i + 1} (teams {b.offset + 1}–{b.offset + b.teams})</span>
                                                    <span>{b.players} players{b.errors > 0 ? ` · ⚠️ ${b.errors} err` : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Errors */}
                                    {playerProgress.errors.length > 0 && (
                                        <div className="text-xs bg-red-50 border border-red-200 rounded p-2 max-h-24 overflow-y-auto">
                                            {playerProgress.errors.map((e, i) => <div key={i} className="text-red-700">{e}</div>)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <SyncCard
                        title="4. Sync Results"
                        description="Fetches final scores for completed matches and creates MatchResultFinal records."
                        icon={Trophy}
                        onSync={() => runAction('results', 'sync_results')}
                        loading={loadingMap['results']}
                        result={resultMap['results']}
                        buttonLabel="Sync Results"
                    />
                    <SyncCard
                        title="5. Sync Standings"
                        description="Fetches live group standings (W/D/L, GD, Pts) from API-Football."
                        icon={BarChart3}
                        onSync={() => runAction('standings', 'sync_standings', { action: 'get_standings' })}
                        loading={loadingMap['standings']}
                        result={resultMap['standings']}
                        buttonLabel="Refresh Standings"
                    />
                    <SyncCard
                        title="6. Sync Match Events"
                        description="Syncs player performance data (goals, cards, minutes) for finished matches."
                        icon={Activity}
                        onSync={() => runAction('events', 'sync_events', { action: 'sync_all_events' })}
                        loading={loadingMap['events']}
                        result={resultMap['events']}
                        buttonLabel="Sync Match Events"
                    />
                </div>

                <p className="text-xs text-gray-400 text-center mt-6">
                    Data from api-football.com · league=1 · season=2026 · Updates every ~2h via scheduled job
                </p>
            </div>
        </div>
    );
}