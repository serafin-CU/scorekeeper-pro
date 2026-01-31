import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function AdminDataSources() {
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({});
    const queryClient = useQueryClient();

    const { data: sources = [], isLoading } = useQuery({
        queryKey: ['dataSources'],
        queryFn: () => base44.entities.DataSource.list()
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.DataSource.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dataSources'] });
            setEditing(null);
            setFormData({});
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.DataSource.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dataSources'] });
            setEditing(null);
            setFormData({});
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.DataSource.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dataSources'] });
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate
        const errors = [];
        if (!formData.base_url?.startsWith('https://')) {
            errors.push('base_url must start with "https://"');
        }
        if (!formData.allowed_paths_regex?.trim()) {
            errors.push('allowed_paths_regex cannot be empty');
        }

        if (errors.length > 0) {
            alert('Validation errors:\n' + errors.join('\n'));
            return;
        }

        if (editing) {
            updateMutation.mutate({ id: editing, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const startEdit = (source) => {
        setEditing(source.id);
        setFormData(source);
    };

    if (isLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Data Sources</h1>
                <Button onClick={() => { setEditing('new'); setFormData({ enabled: true, rate_limit_seconds: 30 }); }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Source
                </Button>
            </div>

            {editing && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editing === 'new' ? 'New Data Source' : 'Edit Data Source'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label>Name</Label>
                                <Input 
                                    value={formData.name || ''} 
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Base URL (must start with https://)</Label>
                                <Input 
                                    value={formData.base_url || ''} 
                                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                                    placeholder="https://example.com"
                                    required
                                />
                            </div>
                            <div>
                                <Label>Allowed Paths Regex</Label>
                                <Input 
                                    value={formData.allowed_paths_regex || ''} 
                                    onChange={(e) => setFormData({ ...formData, allowed_paths_regex: e.target.value })}
                                    placeholder="/matches/.*"
                                    required
                                />
                            </div>
                            <div>
                                <Label>Rate Limit (seconds)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.rate_limit_seconds || 30} 
                                    onChange={(e) => setFormData({ ...formData, rate_limit_seconds: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={formData.enabled !== false}
                                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                />
                                <Label>Enabled</Label>
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Textarea 
                                    value={formData.notes || ''} 
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">Save</Button>
                                <Button type="button" variant="outline" onClick={() => { setEditing(null); setFormData({}); }}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Base URL</TableHead>
                                <TableHead>Regex</TableHead>
                                <TableHead>Rate Limit</TableHead>
                                <TableHead>Enabled</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sources.map(source => (
                                <TableRow key={source.id}>
                                    <TableCell className="font-medium">{source.name}</TableCell>
                                    <TableCell className="text-sm">{source.base_url}</TableCell>
                                    <TableCell className="text-sm font-mono">{source.allowed_paths_regex}</TableCell>
                                    <TableCell>{source.rate_limit_seconds}s</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${source.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {source.enabled ? 'Yes' : 'No'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => startEdit(source)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(source.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}