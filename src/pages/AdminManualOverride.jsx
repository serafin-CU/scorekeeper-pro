import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';

export default function AdminManualOverride() {
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [homeGoals, setHomeGoals] = useState('');
    const [awayGoals, setAwayGoals] = useState('');
    const [reason, setReason] = useState('');
    const queryClient = useQueryClient();

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list('-kickoff_at')
    });

    const { data: results = [] } = useQuery({
        queryKey: ['matchResults'],
        queryFn: () => base44.entities.MatchResultFinal.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const resultsMap = Object.fromEntries(results.map(r => [r.match_id, r]));

    const overrideMutation = useMutation({
        mutationFn: async ({ matchId, homeGoals, awayGoals, reason }) => {
            const user = await base44.auth.me();

            // Create or update MatchResultFinal
            const existing = resultsMap[matchId];
            let resultId;

            if (existing) {
                await base44.entities.MatchResultFinal.update(existing.id, {
                    home_goals: parseInt(homeGoals),
                    away_goals: parseInt(awayGoals),
                    finalized_at: new Date().toISOString()
                });
                resultId = existing.id;
            } else {
                const result = await base44.entities.MatchResultFinal.create({
                    match_id: matchId,
                    home_goals: parseInt(homeGoals),
                    away_goals: parseInt(awayGoals),
                    finalized_at: new Date().toISOString()
                });
                resultId = result.id;
            }

            // Update Match status to FINAL
            await base44.entities.Match.update(matchId, { status: 'FINAL' });

            // Create audit log
            await base44.entities.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'MANUAL_OVERRIDE_MATCH_RESULT',
                entity_type: 'MatchResultFinal',
                entity_id: resultId,
                reason: reason,
                details_json: JSON.stringify({
                    match_id: matchId,
                    home_goals: parseInt(homeGoals),
                    away_goals: parseInt(awayGoals),
                    existing_result: !!existing
                })
            });

            return { resultId };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matchResults'] });
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            setSelectedMatch(null);
            setHomeGoals('');
            setAwayGoals('');
            setReason('');
            alert('Override successful. Re-scoring will happen in next scoring run.');
        },
        onError: (error) => {
            alert('Override failed: ' + error.message);
        }
    });

    const handleOverride = () => {
        if (!selectedMatch || !reason.trim()) {
            alert('Please select a match and provide a reason');
            return;
        }

        const hg = parseInt(homeGoals);
        const ag = parseInt(awayGoals);

        if (isNaN(hg) || isNaN(ag) || hg < 0 || hg > 20 || ag < 0 || ag > 20) {
            alert('Goals must be numbers between 0 and 20');
            return;
        }

        overrideMutation.mutate({
            matchId: selectedMatch,
            homeGoals: hg,
            awayGoals: ag,
            reason
        });
    };

    if (matchesLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Manual Override</h1>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Manual overrides do not delete existing points. 
                    They trigger a re-score which will append new ledger entries.
                    A reason is required for audit purposes.
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Match</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Current Result</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {matches.slice(0, 50).map(match => {
                                    const homeTeam = teamsMap[match.home_team_id];
                                    const awayTeam = teamsMap[match.away_team_id];
                                    const result = resultsMap[match.id];

                                    return (
                                        <TableRow 
                                            key={match.id}
                                            className={selectedMatch === match.id ? 'bg-blue-50' : ''}
                                        >
                                            <TableCell>
                                                <div className="font-medium">
                                                    {homeTeam?.name || 'TBD'} vs {awayTeam?.name || 'TBD'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(match.kickoff_at).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {result ? (
                                                    <span className="font-mono">{result.home_goals}-{result.away_goals}</span>
                                                ) : (
                                                    <span className="text-gray-400">Not set</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => {
                                                        setSelectedMatch(match.id);
                                                        if (result) {
                                                            setHomeGoals(result.home_goals.toString());
                                                            setAwayGoals(result.away_goals.toString());
                                                        } else {
                                                            setHomeGoals('');
                                                            setAwayGoals('');
                                                        }
                                                    }}
                                                >
                                                    Override
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {selectedMatch && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Override Match Result</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Home Goals</Label>
                                <Input 
                                    type="number" 
                                    min="0" 
                                    max="20"
                                    value={homeGoals}
                                    onChange={(e) => setHomeGoals(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Away Goals</Label>
                                <Input 
                                    type="number" 
                                    min="0" 
                                    max="20"
                                    value={awayGoals}
                                    onChange={(e) => setAwayGoals(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Reason (required)</Label>
                                <Textarea 
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Explain why this override is necessary..."
                                    rows={4}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleOverride}>
                                    Save Override
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedMatch(null)}>
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}