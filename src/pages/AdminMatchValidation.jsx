import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminMatchValidation() {
    const { data: validations = [], isLoading: validationsLoading } = useQuery({
        queryKey: ['matchValidations'],
        queryFn: () => base44.entities.MatchValidation.list()
    });

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    if (validationsLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Match Validation Status</h1>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Match</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Locked</TableHead>
                                <TableHead>Reasons</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {validations.map(validation => {
                                const match = matchesMap[validation.match_id];
                                const homeTeam = match ? teamsMap[match.home_team_id] : null;
                                const awayTeam = match ? teamsMap[match.away_team_id] : null;
                                const reasons = JSON.parse(validation.reasons_json || '[]');

                                return (
                                    <TableRow 
                                        key={validation.id}
                                        className={validation.confidence_score === 0 ? 'bg-red-50' : ''}
                                    >
                                        <TableCell>
                                            <div className="font-medium">
                                                {homeTeam?.name || 'TBD'} vs {awayTeam?.name || 'TBD'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {match ? new Date(match.kickoff_at).toLocaleDateString() : ''}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                validation.status_candidate === 'FINAL' ? 'bg-blue-100 text-blue-800' :
                                                validation.status_candidate === 'LIVE' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {validation.status_candidate}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {validation.score_candidate_home !== null && validation.score_candidate_away !== null ? (
                                                <span className="font-mono">
                                                    {validation.score_candidate_home}-{validation.score_candidate_away}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-mono ${
                                                validation.confidence_score >= 70 ? 'bg-green-100 text-green-800' :
                                                validation.confidence_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {validation.confidence_score}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {validation.locked_final ? (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Locked</span>
                                            ) : (
                                                <span className="text-gray-400">Open</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-600 max-w-xs">
                                            {reasons.map((r, i) => (
                                                <div key={i}>• {r}</div>
                                            ))}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}