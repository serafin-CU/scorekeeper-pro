import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Save, X } from 'lucide-react';

export default function AdminMatchSourceLinks() {
    const [editingLink, setEditingLink] = useState(null);
    const [editUrl, setEditUrl] = useState('');
    const [editRole, setEditRole] = useState('FALLBACK');
    const queryClient = useQueryClient();

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: async () => {
            const all = await base44.entities.Match.list();
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return all.filter(m => new Date(m.kickoff_at) <= thirtyDaysFromNow).sort((a, b) => 
                new Date(a.kickoff_at) - new Date(b.kickoff_at)
            );
        }
    });

    const { data: links = [] } = useQuery({
        queryKey: ['matchSourceLinks'],
        queryFn: () => base44.entities.MatchSourceLink.list()
    });

    const { data: allSources = [] } = useQuery({
        queryKey: ['dataSources'],
        queryFn: () => base44.entities.DataSource.list()
    });

    // Filter to show only enabled sources
    const sources = allSources.filter(s => s.enabled);

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const updateLinkMutation = useMutation({
        mutationFn: async ({ id, url, source_id, role, match_id }) => {
            // Validate URL (allows empty for placeholders)
            const validation = await base44.functions.invoke('adminValidationService', {
                action: 'validate_match_source_link',
                url: url && url.trim() !== '' ? url : null,
                source_id
            });

            if (!validation.data.valid) {
                throw new Error(validation.data.errors.join(', '));
            }

            // Validate role constraints: exactly 1 PRIMARY per match
            if (role === 'PRIMARY') {
                const matchLinks = links.filter(l => l.match_id === match_id && l.id !== id);
                const otherPrimary = matchLinks.find(l => l.role === 'PRIMARY');
                if (otherPrimary) {
                    throw new Error('This match already has a PRIMARY source. Change it to FALLBACK first.');
                }
            }

            return base44.entities.MatchSourceLink.update(id, { 
                url: url && url.trim() !== '' ? url : null,
                role
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setEditingLink(null);
            setEditUrl('');
            setEditRole('FALLBACK');
        },
        onError: (error) => {
            alert('Update failed: ' + error.message);
        }
    });



    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const sourcesMap = Object.fromEntries(sources.map(s => [s.id, s]));

    const getLinksForMatch = (matchId) => links.filter(l => l.match_id === matchId);

    const startEdit = (link) => {
        setEditingLink(link.id);
        setEditUrl(link.url || '');
        setEditRole(link.role || 'FALLBACK');
    };

    const saveEdit = (link) => {
        updateLinkMutation.mutate({ 
            id: link.id, 
            url: editUrl, 
            source_id: link.source_id,
            role: editRole,
            match_id: link.match_id
        });
    };

    if (matchesLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Match Source Links (Next 30 Days)</h1>

            <div className="space-y-4">
                {matches.map(match => {
                    const homeTeam = teamsMap[match.home_team_id];
                    const awayTeam = teamsMap[match.away_team_id];
                    const matchLinks = getLinksForMatch(match.id);

                    return (
                        <Card key={match.id}>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {homeTeam?.name || 'TBD'} vs {awayTeam?.name || 'TBD'}
                                    <span className="text-sm font-normal text-gray-500 ml-3">
                                        {new Date(match.kickoff_at).toLocaleString()} | {match.phase}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>URL</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {matchLinks.map(link => {
                                            const source = sourcesMap[link.source_id];
                                            const isEditing = editingLink === link.id;

                                            return (
                                                <TableRow key={link.id}>
                                                    <TableCell className="font-medium">{source?.name || 'Unknown'}</TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <Select value={editRole} onValueChange={setEditRole}>
                                                                <SelectTrigger className="w-32">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                                                                    <SelectItem value="FALLBACK">FALLBACK</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                                link.role === 'PRIMARY' 
                                                                    ? 'bg-blue-100 text-blue-800' 
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {link.role || 'FALLBACK'}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <Input 
                                                                value={editUrl}
                                                                onChange={(e) => setEditUrl(e.target.value)}
                                                                placeholder="https://... (leave empty for placeholder)"
                                                            />
                                                        ) : (
                                                            <span className="text-sm">
                                                                {link.url ? (
                                                                    link.url
                                                                ) : (
                                                                    <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">
                                                                        Needs URL
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <div className="flex gap-2">
                                                                <Button size="sm" onClick={() => saveEdit(link)}>
                                                                    <Save className="w-4 h-4" />
                                                                </Button>
                                                                <Button size="sm" variant="outline" onClick={() => setEditingLink(null)}>
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" onClick={() => startEdit(link)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {matchLinks.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-gray-500">
                                                    No source links configured
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}