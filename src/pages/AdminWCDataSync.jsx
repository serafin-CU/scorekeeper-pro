import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw, Users, Calendar, Trophy, Activity, Zap } from 'lucide-react';

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

function SyncCard({ title, description, icon: Icon, onSync, result, loading, buttonLabel = 'Sync Now', destructive = false }) {
    return (
        <Card>
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
                    disabled={loading}
                    variant={destructive ? 'destructive' : 'default'}
                    className="w-full"
                    style={!destructive ? { background: CU.charcoal } : {}}
                >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {loading ? 'Syncing...' : buttonLabel}
                </Button>
                <ResultCard result={result} loading={loading} />
            </CardContent>
        </Card>
    );
}

export default function AdminWCDataSync() {
    const [loadingMap, setLoadingMap] = useState({});
    const [resultMap, setResultMap] = useState({});
    const [apiStatus, setApiStatus] = useState(null);
    const [apiStatusLoading, setApiStatusLoading] = useState(false);

    const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
    const { data: matches = [] } = useQuery({ queryKey: ['matches'], queryFn: () => base44.entities.Match.list() });
    const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: () => base44.entities.Player.list() });
    const { data: results = [] } = useQuery({ queryKey: ['matchResults'], queryFn: () => base44.entities.MatchResultFinal.list() });

    const setLoading = (key, val) => setLoadingMap(prev => ({ ...prev, [key]: val }));
    const setResult = (key, val) => setResultMap(prev => ({ ...prev, [key]: val }));

    const runAction = async (key, action, extra = {}) => {
        setLoading(key, true);
        setResult(key, null);
        try {
            const res = await base44.functions.invoke('wcDataSync', { action, ...extra });
            setResult(key, res.data);
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
                    <SyncCard
                        title="3. Sync Players"
                        description="Fetches squad rosters for all 48 teams (~700 players). Requires teams synced."
                        icon={Zap}
                        onSync={() => runAction('players', 'sync_players')}
                        loading={loadingMap['players']}
                        result={resultMap['players']}
                        buttonLabel="Sync Player Squads"
                        destructive
                    />
                    <SyncCard
                        title="4. Sync Results"
                        description="Fetches final scores for completed matches and creates MatchResultFinal records."
                        icon={Trophy}
                        onSync={() => runAction('results', 'sync_results')}
                        loading={loadingMap['results']}
                        result={resultMap['results']}
                        buttonLabel="Sync Results"
                    />
                </div>

                <p className="text-xs text-gray-400 text-center mt-6">
                    Data from api-football.com · league=1 · season=2026 · Updates every ~2h via scheduled job
                </p>
            </div>
        </div>
    );
}