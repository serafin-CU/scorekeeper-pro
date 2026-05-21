import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2 } from 'lucide-react';

export default function TestDataResetter() {
    const [resetRunning, setResetRunning] = useState(false);
    const [resetCounts, setResetCounts] = useState(null);
    const [confirmClick, setConfirmClick] = useState(null); // { timestamp, timerId }

    const handleResetClick = () => {
        if (confirmClick) {
            // Second click within window - execute reset
            if (confirmClick.timerId) {
                clearTimeout(confirmClick.timerId);
            }
            setConfirmClick(null);
            resetAllTestData();
        } else {
            // First click - set confirmation window
            const timerId = setTimeout(() => {
                setConfirmClick(null);
            }, 5000);
            setConfirmClick({ timestamp: Date.now(), timerId });
        }
    };

    const resetAllTestData = async () => {

        setResetRunning(true);
        setResetCounts(null);
        const counts = {
            FantasySquadPlayer: 0,
            FantasySquad: 0,
            PointsLedger: 0,
            FantasyMatchPlayerStats: 0,
            MatchResultFinal: 0,
            Match: 0,
            Player: 0,
            Team: 0,
            DataSource: 0
        };

        try {
            // Helper to check if row is test data
            const isTestRow = (row) => {
                if (!row.details_json) return false;
                try {
                    const d = typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json;
                    return d.is_test === true;
                } catch { return false; }
            };

            // Also check breakdown_json for PointsLedger AWARD entries
            const isTestLedgerEntry = (entry) => {
                // Check details_json first
                if (entry.details_json) {
                    try {
                        const d = typeof entry.details_json === 'string' ? JSON.parse(entry.details_json) : entry.details_json;
                        if (d.is_test === true) return true;
                    } catch { /* skip */ }
                }
                // Check breakdown_json for AWARD entries
                if (entry.breakdown_json && entry.mode === 'FANTASY') {
                    try {
                        const b = typeof entry.breakdown_json === 'string' ? JSON.parse(entry.breakdown_json) : entry.breakdown_json;
                        if (b.type === 'AWARD') return true;
                    } catch { /* skip */ }
                }
                return false;
            };

            // Delete in dependency order (children first, then parents)
            
            // 1. FantasySquadPlayer
            const allSP = await base44.entities.FantasySquadPlayer.list();
            for (const sp of allSP) {
                if (isTestRow(sp)) {
                    await base44.entities.FantasySquadPlayer.delete(sp.id);
                    counts.FantasySquadPlayer++;
                }
            }

            // 2. FantasySquad
            const allSQ = await base44.entities.FantasySquad.list();
            for (const sq of allSQ) {
                if (isTestRow(sq)) {
                    await base44.entities.FantasySquad.delete(sq.id);
                    counts.FantasySquad++;
                }
            }

            // 3. PointsLedger (AWARD entries)
            const allLedger = await base44.entities.PointsLedger.list();
            for (const entry of allLedger) {
                if (isTestLedgerEntry(entry)) {
                    await base44.entities.PointsLedger.delete(entry.id);
                    counts.PointsLedger++;
                }
            }

            // 4. FantasyMatchPlayerStats
            const allStats = await base44.entities.FantasyMatchPlayerStats.list();
            for (const s of allStats) {
                if (isTestRow(s)) {
                    await base44.entities.FantasyMatchPlayerStats.delete(s.id);
                    counts.FantasyMatchPlayerStats++;
                }
            }

            // 5. MatchResultFinal
            const allMRF = await base44.entities.MatchResultFinal.list();
            for (const mrf of allMRF) {
                if (isTestRow(mrf)) {
                    await base44.entities.MatchResultFinal.delete(mrf.id);
                    counts.MatchResultFinal++;
                }
            }

            // 6. Match
            const allMatches = await base44.entities.Match.list();
            for (const m of allMatches) {
                if (isTestRow(m)) {
                    await base44.entities.Match.delete(m.id);
                    counts.Match++;
                }
            }

            // 7. Player
            const allPlayers = await base44.entities.Player.list();
            for (const p of allPlayers) {
                if (isTestRow(p)) {
                    await base44.entities.Player.delete(p.id);
                    counts.Player++;
                }
            }

            // 8. Team
            const allTeams = await base44.entities.Team.list();
            for (const t of allTeams) {
                if (isTestRow(t)) {
                    await base44.entities.Team.delete(t.id);
                    counts.Team++;
                }
            }

            // 9. DataSource
            const allSources = await base44.entities.DataSource.list();
            for (const source of allSources) {
                if (!source.notes) continue;
                try {
                    const d = typeof source.notes === 'string' ? JSON.parse(source.notes) : source.notes;
                    if (d.is_test === true) {
                        await base44.entities.DataSource.delete(source.id);
                        counts.DataSource++;
                    }
                } catch { /* skip */ }
            }

            setResetCounts(counts);

        } catch (error) {
            alert('Cleanup error: ' + error.message);
        }

        setResetRunning(false);
    };

    const totalDeleted = resetCounts ? Object.values(resetCounts).reduce((a, b) => a + b, 0) : 0;

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    Admin: Reset All Test Data
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Deletes ALL rows where <code className="text-xs bg-muted px-1">details_json.is_test = true</code> across all entities.
                    Use this to clean up orphan test data from failed TEST 6 runs.
                </p>
                
                <Button
                    onClick={handleResetClick}
                    disabled={resetRunning}
                    variant="destructive"
                    className="w-full"
                >
                    {resetRunning ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Deleting test data...
                        </>
                    ) : confirmClick ? (
                        <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Click again within 5s to CONFIRM
                        </>
                    ) : (
                        <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Reset All Test Data
                        </>
                    )}
                </Button>

                {resetCounts && (
                    <div className="p-4 bg-green-50 rounded border border-green-200">
                        <div className="text-green-800 font-semibold mb-2">
                            ✓ Cleanup Complete - {totalDeleted} rows deleted
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                            {Object.entries(resetCounts).map(([entity, count]) => (
                                count > 0 && (
                                    <div key={entity} className="flex justify-between">
                                        <span>{entity}:</span>
                                        <span className="font-mono">{count}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}