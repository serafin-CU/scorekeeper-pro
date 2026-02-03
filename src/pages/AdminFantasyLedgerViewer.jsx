import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function AdminFantasyLedgerViewer() {
    const [selectedMatchId, setSelectedMatchId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('match') || null;
    });
    const [showAllModes, setShowAllModes] = useState(true);
    const [showVoids, setShowVoids] = useState(true);
    const queryClient = useQueryClient();

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const { data: allLedger = [] } = useQuery({
        queryKey: ['fantasyLedger'],
        queryFn: async () => {
            const allEntries = await base44.entities.PointsLedger.list();
            // Show any mode starting with FANTASY
            return allEntries.filter(e => e.mode?.startsWith('FANTASY'));
        }
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list()
    });

    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));

    const getMatchLabel = (match) => {
        const homeTeam = teamsMap[match.home_team_id];
        const awayTeam = teamsMap[match.away_team_id];
        const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
        const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';
        const date = new Date(match.kickoff_at).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const shortId = match.id.slice(-8);
        return `${date}  ${homeName} vs ${awayName} (${match.phase}) · ${shortId}`;
    };

    const filteredLedger = (() => {
        let filtered = allLedger;
        
        // Filter by match
        if (selectedMatchId) {
            filtered = filtered.filter(e => {
                if (e.source_id && e.source_id.includes(selectedMatchId)) return true;
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === selectedMatchId;
                } catch {
                    return false;
                }
            });
        }
        
        // Filter voids
        if (!showVoids) {
            filtered = filtered.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type !== 'VOID';
                } catch {
                    return true;
                }
            });
        }
        
        return filtered;
    })();
    
    // Compute net points for selected match
    const netPoints = selectedMatchId ? filteredLedger.reduce((sum, e) => sum + e.points, 0) : null;

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Fantasy Ledger Viewer</h1>
                <Button 
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['fantasyLedger'] })}
                    variant="outline"
                    size="sm"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Match Filter</label>
                        <Select value={selectedMatchId || 'all'} onValueChange={(val) => setSelectedMatchId(val === 'all' ? null : val)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All matches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Matches</SelectItem>
                                {finalizedMatches.map(match => (
                                    <SelectItem key={match.id} value={match.id}>
                                        {getMatchLabel(match)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="showAllModes" 
                                checked={showAllModes}
                                onChange={(e) => setShowAllModes(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="showAllModes" className="text-sm font-medium">
                                Show all FANTASY modes (FANTASY, FANTASY_VOID, etc.)
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="showVoids" 
                                checked={showVoids}
                                onChange={(e) => setShowVoids(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="showVoids" className="text-sm font-medium">
                                Show voids
                            </label>
                        </div>
                    </div>
                    
                    {selectedMatchId && netPoints !== null && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-900">
                                Net Points for Selected Match
                            </div>
                            <div className={`text-2xl font-bold ${netPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {netPoints > 0 ? '+' : ''}{netPoints}
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                                {showVoids ? 'Including void entries' : 'Excluding void entries'}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ledger Entries ({filteredLedger.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredLedger.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No ledger entries found. Run "Dev Fantasy Setup" or use "Fantasy Scoring Controls" to create entries.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Source Type</TableHead>
                                    <TableHead>Source ID</TableHead>
                                    <TableHead>Points</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLedger.map(entry => {
                                    const user = usersMap[entry.user_id];
                                    let breakdown = {};
                                    try {
                                        breakdown = JSON.parse(entry.breakdown_json);
                                    } catch {}

                                    const isVoid = breakdown.type === 'VOID';

                                    return (
                                        <TableRow key={entry.id} className={isVoid ? 'bg-red-50' : ''}>
                                            <TableCell className="font-medium text-xs">
                                                {user?.email || entry.user_id}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{entry.mode}</TableCell>
                                            <TableCell className="text-xs">{entry.source_type}</TableCell>
                                            <TableCell className="text-xs font-mono truncate max-w-[120px]" title={entry.source_id}>
                                                {entry.source_id}
                                            </TableCell>
                                            <TableCell className={`font-semibold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {entry.points > 0 ? '+' : ''}{entry.points}
                                            </TableCell>
                                            <TableCell>
                                                {isVoid ? (
                                                    <Badge variant="destructive">VOID</Badge>
                                                ) : (
                                                    <Badge className="bg-green-600">AWARD</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {isVoid ? (
                                                    `Voided ${breakdown.voided_points} pts`
                                                ) : breakdown.captain ? (
                                                    <div className="space-y-0.5">
                                                        <div>{breakdown.per_player?.length || 0} players</div>
                                                        {breakdown.captain.player_name && (
                                                            <div className="text-blue-700">
                                                                <strong>C:</strong> {breakdown.captain.player_name}
                                                            </div>
                                                        )}
                                                        {breakdown.captain.delta_from_multiplier > 0 && (
                                                            <div className="text-green-700 font-semibold">
                                                                +{breakdown.captain.delta_from_multiplier} (2x)
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    `${breakdown.per_player?.length || 0} players`
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {new Date(entry.created_date).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}