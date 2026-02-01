import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function AdminFantasyLedgerViewer() {
    const [selectedMatchId, setSelectedMatchId] = useState(null);

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: allLedger = [] } = useQuery({
        queryKey: ['fantasyLedger'],
        queryFn: async () => {
            const entries = await base44.entities.PointsLedger.filter({ mode: 'FANTASY' });
            return entries;
        }
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list()
    });

    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));

    const filteredLedger = selectedMatchId 
        ? allLedger.filter(e => {
            try {
                const breakdown = JSON.parse(e.breakdown_json);
                return breakdown.match_id === selectedMatchId;
            } catch {
                return false;
            }
        })
        : allLedger;

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Fantasy Ledger Viewer</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filter by Match (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={selectedMatchId || 'all'} onValueChange={(val) => setSelectedMatchId(val === 'all' ? null : val)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="All matches" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Matches</SelectItem>
                            {finalizedMatches.map(match => (
                                <SelectItem key={match.id} value={match.id}>
                                    {match.phase} - {new Date(match.kickoff_at).toLocaleDateString()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ledger Entries ({filteredLedger.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredLedger.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No fantasy ledger entries found
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Points</TableHead>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Phase</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Date</TableHead>
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
                                    const match = matchesMap[breakdown.match_id];

                                    return (
                                        <TableRow key={entry.id} className={isVoid ? 'bg-red-50' : 'bg-green-50'}>
                                            <TableCell className="font-medium">
                                                {user?.full_name || user?.email || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                {isVoid ? (
                                                    <Badge variant="destructive">VOID</Badge>
                                                ) : (
                                                    <Badge className="bg-green-600">AWARD</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className={`font-semibold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {entry.points > 0 ? '+' : ''}{entry.points}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {match ? `${match.phase}` : breakdown.match_id?.slice(0, 8)}
                                            </TableCell>
                                            <TableCell>{breakdown.phase}</TableCell>
                                            <TableCell>
                                                <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                    {breakdown.scoring_version || '-'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs max-w-xs truncate">
                                                {isVoid 
                                                    ? `Voided ${breakdown.voided_points} pts` 
                                                    : `${breakdown.per_player?.length || 0} players, ${breakdown.totals?.squad_points || 0} pts`
                                                }
                                            </TableCell>
                                            <TableCell className="text-xs">
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