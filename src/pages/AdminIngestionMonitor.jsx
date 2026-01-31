import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export default function AdminIngestionMonitor() {
    const [selectedRun, setSelectedRun] = useState(null);
    const [selectedMatch, setSelectedMatch] = useState(null);

    const { data: runs = [], isLoading: runsLoading } = useQuery({
        queryKey: ['ingestionRuns'],
        queryFn: async () => {
            const all = await base44.entities.IngestionRun.list('-started_at', 50);
            return all;
        }
    });

    const { data: events = [] } = useQuery({
        queryKey: ['ingestionEvents', selectedRun, selectedMatch],
        queryFn: async () => {
            if (selectedRun) {
                return base44.entities.IngestionEvent.filter({ run_id: selectedRun }, '-fetched_at', 100);
            } else if (selectedMatch) {
                return base44.entities.IngestionEvent.filter({ match_id: selectedMatch }, '-fetched_at', 50);
            }
            return [];
        },
        enabled: !!(selectedRun || selectedMatch)
    });

    const { data: sources = [] } = useQuery({
        queryKey: ['dataSources'],
        queryFn: () => base44.entities.DataSource.list()
    });

    const sourcesMap = Object.fromEntries(sources.map(s => [s.id, s]));

    const [detailEvent, setDetailEvent] = useState(null);

    if (runsLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Ingestion Monitor</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Ingestion Runs (Last 50)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Started</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runs.map(run => (
                                    <TableRow key={run.id} className="cursor-pointer hover:bg-gray-50">
                                        <TableCell className="text-sm">
                                            {new Date(run.started_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                run.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                                run.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {run.status}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="sm" variant="ghost" onClick={() => setSelectedRun(run.id)}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {selectedRun && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Events for Run</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Source</TableHead>
                                        <TableHead>HTTP</TableHead>
                                        <TableHead>Parse</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map(event => (
                                        <TableRow key={event.id}>
                                            <TableCell className="text-sm">
                                                {sourcesMap[event.source_id]?.name || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    event.http_status === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {event.http_status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    event.parse_status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {event.parse_status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Button size="sm" variant="ghost" onClick={() => setDetailEvent(event)}>
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            {detailEvent && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Event Detail</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <strong>Source:</strong> {sourcesMap[detailEvent.source_id]?.name}
                            </div>
                            <div>
                                <strong>Fetched At:</strong> {new Date(detailEvent.fetched_at).toLocaleString()}
                            </div>
                            <div>
                                <strong>HTTP Status:</strong> {detailEvent.http_status}
                            </div>
                            <div>
                                <strong>Parse Status:</strong> {detailEvent.parse_status}
                            </div>
                            {detailEvent.error_message && (
                                <div>
                                    <strong>Error:</strong> 
                                    <pre className="mt-2 p-3 bg-red-50 text-red-900 rounded text-sm">{detailEvent.error_message}</pre>
                                </div>
                            )}
                            <div>
                                <strong>Parsed JSON:</strong>
                                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-96">
                                    {JSON.stringify(JSON.parse(detailEvent.parsed_json), null, 2)}
                                </pre>
                            </div>
                            <Button onClick={() => setDetailEvent(null)}>Close</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}