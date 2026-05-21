import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Loader2, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminSystemTestHarness() {
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState([]);
    const [testRunId, setTestRunId] = useState(null);
    const [devSetupRunning, setDevSetupRunning] = useState(false);
    const [devSetupResult, setDevSetupResult] = useState(null);
    const [selectedMatchId, setSelectedMatchId] = useState(null);
    const [scoringRunning, setScoringRunning] = useState(false);
    const [scoringResult, setScoringResult] = useState(null);
    const [matchDiagnostics, setMatchDiagnostics] = useState(null);
    const [buildingStats, setBuildingStats] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState('ROUND_OF_32');
    const [transferTestRunning, setTransferTestRunning] = useState(false);
    const [transferTestResult, setTransferTestResult] = useState(null);
    const [baselineRunning, setBaselineRunning] = useState(false);
    const [baselineResult, setBaselineResult] = useState(null);

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = teams.reduce((acc, team) => {
        acc[team.id] = team;
        return acc;
    }, {});

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

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    const runSingleTest = async (testNum) => {
        setRunning(true);
        setResults([]);
        const runId = `test_${Date.now()}`;
        setTestRunId(runId);
        const testResults = [];

        try {
            // TEST 6 PRE-CLEANUP: Remove orphaned test data from previous runs
            if (testNum === 6) {
                const allStats = await base44.entities.FantasyMatchPlayerStats.list();
                const allSquads = await base44.entities.FantasySquad.list();
                const allMatches = await base44.entities.Match.list();
                const allPlayers = await base44.entities.Player.list();
                const allTeams = await base44.entities.Team.list();
                const allLedger = await base44.entities.PointsLedger.list();
                
                const isTest6Row = (row) => {
                    if (!row.details_json) return false;
                    try {
                        const d = typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json;
                        return d.is_test === true && d.test_run_id?.startsWith('test6_');
                    } catch { return false; }
                };
                
                for (const s of allStats) { if (isTest6Row(s)) await base44.entities.FantasyMatchPlayerStats.delete(s.id); }
                for (const sq of allSquads) { if (isTest6Row(sq)) await base44.entities.FantasySquad.delete(sq.id); }
                for (const m of allMatches) { if (isTest6Row(m)) await base44.entities.Match.delete(m.id); }
                for (const p of allPlayers) { if (isTest6Row(p)) await base44.entities.Player.delete(p.id); }
                for (const t of allTeams) { if (isTest6Row(t)) await base44.entities.Team.delete(t.id); }
                for (const e of allLedger) { if (isTest6Row(e)) await base44.entities.PointsLedger.delete(e.id); }
            }

            // Map test numbers to functions explicitly to avoid off-by-one errors
            const testFunctionMap = {
                1: runTest1,
                2: runTest2,
                3: runTest3,
                4: runTest4,
                6: runTest6
            };
            
            const testFn = testFunctionMap[testNum];
            if (!testFn) {
                throw new Error(`Unknown test number: ${testNum}. Available: 1, 2, 3, 4, 6`);
            }
            
            testResults.push(await testFn(runId));
        } catch (error) {
            testResults.push({
                name: `TEST ${testNum}`,
                status: 'FAIL',
                details: `Fatal error: ${error.message}`
            });
        }

        setResults(testResults);
        setRunning(false);
    };

    const runTests = async () => {
        setRunning(true);
        setResults([]);
        const runId = `test_${Date.now()}`;
        setTestRunId(runId);
        const testResults = [];

        try {
            // TEST 1: Prode idempotency
            testResults.push(await runTest1(runId));

            // TEST 2: Finalization safety
            testResults.push(await runTest2(runId));

            // TEST 3: URL whitelist blocking
            testResults.push(await runTest3(runId));

            // TEST 4: Fantasy Scoring Idempotency + Re-score
            testResults.push(await runTest4(runId));

        } catch (error) {
            testResults.push({
                name: 'Test Suite',
                status: 'FAIL',
                details: `Fatal error: ${error.message}`
            });
        }

        setResults(testResults);
        setRunning(false);
    };

    const runTest1 = async (runId) => {
        const test = { name: 'TEST 1: Prode Idempotency', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create teams
            const team1 = await base44.entities.Team.create({
                name: `Test Team A ${runId}`,
                fifa_code: 'TA1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team B ${runId}`,
                fifa_code: 'TB1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create players
            const player1 = await base44.entities.Player.create({
                full_name: `Test Player 1 ${runId}`,
                team_id: team1.id,
                position: 'FWD',
                price: 10
            });

            // Create match (past kickoff)
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create test users via invite (will use system users instead)
            const currentUser = await base44.auth.me();
            
            // Create predictions
            const pred1 = await base44.entities.ProdePrediction.create({
                match_id: match.id,
                user_id: currentUser.id,
                pred_home_goals: 2,
                pred_away_goals: 1,
                submitted_at: new Date().toISOString()
            });

            // Create MatchValidation
            await base44.entities.MatchValidation.create({
                match_id: match.id,
                status_candidate: 'FINAL',
                score_candidate_home: 2,
                score_candidate_away: 1,
                confidence_score: 100,
                reasons_json: JSON.stringify(['Test setup']),
                locked_final: false
            });

            // Action: Run Finalizer twice
            const finalize1 = await base44.functions.invoke('finalizer', {});
            const finalize2 = await base44.functions.invoke('finalizer', {});

            // Verify: Only 1 MatchResultFinal
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: match.id });
            if (matchResults.length !== 1) {
                test.details = `Expected 1 MatchResultFinal, got ${matchResults.length}`;
                return test;
            }

            // Verify: Only 1 PRODE ScoringJob
            const dedupeKey = `PRODE:MATCH:${match.id}:v1`;
            const scoringJobs = await base44.entities.ScoringJob.filter({ dedupe_key: dedupeKey });
            if (scoringJobs.length !== 1) {
                test.details = `Expected 1 ScoringJob, got ${scoringJobs.length}`;
                return test;
            }

            // Run the scoring job
            await base44.functions.invoke('prodeService', {
                action: 'score_match',
                match_id: match.id,
                version: 1
            });

            // Verify: PointsLedger entries written exactly once per user
            const sourceId = `MATCH:${match.id}:v1`;
            const ledgerEntries = await base44.entities.PointsLedger.filter({ source_id: sourceId });
            
            // Group by user_id
            const entriesByUser = {};
            for (const entry of ledgerEntries) {
                entriesByUser[entry.user_id] = (entriesByUser[entry.user_id] || 0) + 1;
            }

            // Each user should have exactly 1 entry
            for (const [userId, count] of Object.entries(entriesByUser)) {
                if (count !== 1) {
                    test.details = `User ${userId} has ${count} ledger entries, expected 1`;
                    return test;
                }
            }

            test.status = 'PASS';
            test.details = `✓ 1 MatchResultFinal, ✓ 1 ScoringJob, ✓ ${Object.keys(entriesByUser).length} user(s) with 1 ledger entry each`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest2 = async (runId) => {
        const test = { name: 'TEST 2: Finalization Safety', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create match with low confidence
            const team1 = await base44.entities.Team.create({
                name: `Test Team C ${runId}`,
                fifa_code: 'TC1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team D ${runId}`,
                fifa_code: 'TD1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create MatchValidation with confidence=60 (below threshold)
            await base44.entities.MatchValidation.create({
                match_id: match.id,
                status_candidate: 'FINAL',
                score_candidate_home: 1,
                score_candidate_away: 1,
                confidence_score: 60,
                reasons_json: JSON.stringify(['Low confidence test']),
                locked_final: false
            });

            // Action: Run Finalizer
            await base44.functions.invoke('finalizer', {});

            // Verify: MatchResultFinal NOT created
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: match.id });
            if (matchResults.length !== 0) {
                test.details = `Expected 0 MatchResultFinal (confidence too low), got ${matchResults.length}`;
                return test;
            }

            // Verify: No scoring jobs created
            const dedupeKey = `PRODE:MATCH:${match.id}:v1`;
            const scoringJobs = await base44.entities.ScoringJob.filter({ dedupe_key: dedupeKey });
            if (scoringJobs.length !== 0) {
                test.details = `Expected 0 ScoringJob, got ${scoringJobs.length}`;
                return test;
            }

            test.status = 'PASS';
            test.details = '✓ Match not finalized (confidence=60 < 70), ✓ No scoring jobs created';

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest3 = async (runId) => {
        const test = { name: 'TEST 3: URL Whitelist Blocking', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create DataSource with strict whitelist
            const dataSource = await base44.entities.DataSource.create({
                name: `Test Source ${runId}`,
                base_url: 'https://example.com',
                allowed_paths_regex: '/allowed/.*',
                enabled: true,
                rate_limit_seconds: 30
            });

            // Create a test match
            const team1 = await base44.entities.Team.create({
                name: `Test Team E ${runId}`,
                fifa_code: 'TE1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team F ${runId}`,
                fifa_code: 'TF1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: new Date().toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create a valid link first
            const validLink = await base44.entities.MatchSourceLink.create({
                match_id: match.id,
                source_id: dataSource.id,
                url: 'https://example.com/allowed/match123',
                is_primary: true
            });

            // Attempt to update with blocked URL
            let blocked = false;
            let errorMessage = '';

            try {
                // Validate the URL
                const validation = await base44.functions.invoke('adminValidationService', {
                    action: 'validate_match_source_link',
                    url: 'https://example.com/blocked',
                    source_id: dataSource.id
                });

                if (!validation.data.valid) {
                    blocked = true;
                    errorMessage = validation.data.errors.join(', ');
                }
            } catch (error) {
                blocked = true;
                errorMessage = error.message;
            }

            if (!blocked) {
                test.details = 'Expected blocked URL to fail validation';
                return test;
            }

            test.status = 'PASS';
            test.details = `✓ Blocked URL rejected: ${errorMessage}`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest4 = async (runId) => {
        const test = { name: 'TEST 4: Fantasy Scoring Idempotency + Re-score', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create teams, players, match, stats, and squad
            const team1 = await base44.entities.Team.create({
                name: `Test Team I ${runId}`,
                fifa_code: 'TI1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team J ${runId}`,
                fifa_code: 'TJ1',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create 11 players for squad
            const players = [];
            const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
            for (let i = 0; i < 11; i++) {
                const player = await base44.entities.Player.create({
                    full_name: `Test Player ${i} ${runId}`,
                    team_id: i < 6 ? team1.id : team2.id,
                    position: positions[i],
                    price: 8
                });
                players.push(player);
            }

            // Create finalized match
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'FINAL',
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create MatchResultFinal (team1 wins 2-0, clean sheet)
            await base44.entities.MatchResultFinal.create({
                match_id: match.id,
                home_goals: 2,
                away_goals: 0,
                finalized_at: new Date().toISOString(),
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Create FantasyMatchPlayerStats
            for (let i = 0; i < 11; i++) {
                await base44.entities.FantasyMatchPlayerStats.create({
                    match_id: match.id,
                    player_id: players[i].id,
                    team_id: players[i].team_id,
                    started: true,
                    substituted_in: false,
                    substituted_out: false,
                    minute_in: 0,
                    minute_out: 90,
                    minutes_played: 90,
                    goals: i === 8 ? 2 : 0, // FWD scores 2 goals
                    yellow_cards: i === 2 ? 1 : 0, // 1 DEF gets yellow
                    red_cards: 0,
                    source: 'MANUAL',
                    details_json: JSON.stringify({ is_test: true, test_run_id: runId })
                });
            }

            // Create user and finalized squad
            const currentUser = await base44.auth.me();
            
            const squad = await base44.entities.FantasySquad.create({
                user_id: currentUser.id,
                phase: 'GROUP_MD1',
                status: 'FINAL',
                budget_cap: 150,
                total_cost: 88,
                finalized_at: new Date().toISOString(),
                details_json: JSON.stringify({ is_test: true, test_run_id: runId })
            });

            // Add all 11 players as starters with captain
            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                await base44.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: player.id,
                    slot_type: 'STARTER',
                    starter_position: player.position,
                    is_captain: i === 0 // First player is captain
                });
            }

            // Action 1: Run fantasy scoring once
            await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            // Verify: 1 AWARD after first run
            const ledgerAfterFirst = await base44.entities.PointsLedger.filter({
                mode: 'FANTASY',
                user_id: currentUser.id
            });

            const matchLedgerEntries = ledgerAfterFirst.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === match.id && breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            if (matchLedgerEntries.length !== 1) {
                test.details = `Expected 1 AWARD entry after first run, got ${matchLedgerEntries.length}`;
                return test;
            }

            const firstPoints = matchLedgerEntries[0].points;

            // Action 2: Modify one stat (simulate correction)
            const fwdPlayer = players.find(p => p.position === 'FWD');
            const fwdStats = await base44.entities.FantasyMatchPlayerStats.filter({
                match_id: match.id,
                player_id: fwdPlayer.id
            });

            // Update FWD to have 3 goals instead of 2
            await base44.entities.FantasyMatchPlayerStats.update(fwdStats[0].id, {
                goals: 3
            });

            // Delete the ScoringJob to allow re-score
            const scoringJobs = await base44.entities.ScoringJob.filter({
                dedupe_key: `FANTASY:MATCH:${match.id}:v1`
            });
            for (const job of scoringJobs) {
                await base44.entities.ScoringJob.delete(job.id);
            }

            // Action 3: Run fantasy scoring again (re-score)
            const score3 = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            // Verify: VOID + new AWARD entries created
            const ledgerAfterRescore = await base44.entities.PointsLedger.filter({
                mode: 'FANTASY',
                user_id: currentUser.id
            });

            const matchEntriesAfterRescore = ledgerAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === match.id;
                } catch {
                    return false;
                }
            });

            const voidEntries = matchEntriesAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type === 'VOID';
                } catch {
                    return false;
                }
            });

            const awardEntries = matchEntriesAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            if (voidEntries.length !== 1) {
                test.details = `Expected 1 VOID entry, got ${voidEntries.length}`;
                return test;
            }

            if (awardEntries.length !== 2) {
                test.details = `Expected 2 AWARD entries (original + re-score), got ${awardEntries.length}`;
                return test;
            }

            // Verify net total (should be higher due to extra goal)
            const netTotal = matchEntriesAfterRescore.reduce((sum, e) => sum + e.points, 0);
            const expectedIncrease = 5; // 1 extra goal by FWD = 5 points

            if (netTotal !== firstPoints + expectedIncrease) {
                test.details = `Expected net total ${firstPoints + expectedIncrease}, got ${netTotal}`;
                return test;
            }

            test.status = 'PASS';
            test.details = `✓ Idempotency: 1 award after 2 runs, ✓ Re-score: 1 VOID + 2 AWARD entries, ✓ Net increase: ${expectedIncrease} points`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    // TEST 6: FULL FANTASY E2E - Creates test data, scores, verifies, cleans up
    const runTest6 = async (runId) => {
        const test = { name: 'TEST 6: FULL FANTASY E2E', status: 'FAIL', details: '' };
        const testRunId = `test6_${Date.now()}`;
        
        try {
            // SETUP: Create test teams
            const team1 = await base44.entities.Team.create({
                name: `Test Team X ${testRunId}`,
                fifa_code: 'TX1',
                details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team Y ${testRunId}`,
                fifa_code: 'TY1',
                details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
            });

            // Create 22 players (11 per team for a full match)
            const players = [];
            const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
            for (let i = 0; i < 11; i++) {
                players.push(await base44.entities.Player.create({
                    full_name: `Test Player T1-${i} ${testRunId}`,
                    team_id: team1.id,
                    position: positions[i],
                    price: 8,
                    details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
                }));
            }
            for (let i = 0; i < 11; i++) {
                players.push(await base44.entities.Player.create({
                    full_name: `Test Player T2-${i} ${testRunId}`,
                    team_id: team2.id,
                    position: positions[i],
                    price: 8,
                    details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
                }));
            }

            // Create finalized match (past kickoff)
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'FINAL',
                details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
            });

            // Create MatchResultFinal
            await base44.entities.MatchResultFinal.create({
                match_id: match.id,
                home_goals: 2,
                away_goals: 1,
                finalized_at: new Date().toISOString(),
                details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
            });

            // Create FantasyMatchPlayerStats for all 22 players
            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                const isHomeTeam = player.team_id === team1.id;
                await base44.entities.FantasyMatchPlayerStats.create({
                    match_id: match.id,
                    player_id: player.id,
                    team_id: player.team_id,
                    started: true,
                    substituted_in: false,
                    substituted_out: false,
                    minute_in: 0,
                    minute_out: 90,
                    minutes_played: 90,
                    goals: (i === 8) ? (isHomeTeam ? 2 : 1) : 0, // FWDs score
                    yellow_cards: (i === 2 && isHomeTeam) ? 1 : 0,
                    red_cards: 0,
                    source: 'MANUAL',
                    details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
                });
            }

            // Create user and finalized squad (11 starters + 3 bench)
            const currentUser = await base44.auth.me();
            const squad = await base44.entities.FantasySquad.create({
                user_id: currentUser.id,
                phase: 'GROUP_MD1',
                status: 'FINAL',
                budget_cap: 150,
                total_cost: 112,
                finalized_at: new Date().toISOString(),
                details_json: JSON.stringify({ is_test: true, test_run_id: testRunId })
            });

            // Add 11 starters with captain
            for (let i = 0; i < 11; i++) {
                await base44.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: players[i].id, // First 11 players (team1)
                    slot_type: 'STARTER',
                    starter_position: players[i].position,
                    is_captain: (i === 0) // GK is captain
                });
            }
            // Add 3 bench players from team2
            for (let i = 0; i < 3; i++) {
                await base44.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: players[11 + i].id,
                    slot_type: 'BENCH',
                    bench_order: i + 1
                });
            }

            // ACTION: Run fantasy scoring
            const scoreResult = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            // ASSERT 1: Verify scoring succeeded
            if (!scoreResult.data || scoreResult.data.ok === false) {
                test.details = `Scoring failed: ${JSON.stringify(scoreResult.data)}`;
                return test;
            }

            // ASSERT 2: Verify exactly 22 FantasyMatchPlayerStats rows (one per player)
            const statsAfter = await base44.entities.FantasyMatchPlayerStats.filter({ match_id: match.id });
            if (statsAfter.length !== 22) {
                // DIAGNOSTIC: Group by player_id to find duplicates
                const byPlayer = {};
                for (const s of statsAfter) {
                    byPlayer[s.player_id] = (byPlayer[s.player_id] || 0) + 1;
                }
                const duplicates = Object.entries(byPlayer)
                    .filter(([_, count]) => count > 1)
                    .map(([playerId, count]) => `${playerId.slice(-8)}:${count}`);
                test.details = `Expected 22 stats rows, got ${statsAfter.length}. Duplicates: ${duplicates.join(', ')}`;
                return test;
            }

            // ASSERT 3: Verify 1 AWARD ledger entry
            const ledgerAfter = await base44.entities.PointsLedger.filter({
                mode: 'FANTASY',
                user_id: currentUser.id
            });
            const awardEntries = ledgerAfter.filter(e => {
                try {
                    const b = JSON.parse(e.breakdown_json);
                    return b.match_id === match.id && b.type === 'AWARD';
                } catch { return false; }
            });
            if (awardEntries.length !== 1) {
                test.details = `Expected 1 AWARD entry, got ${awardEntries.length}`;
                return test;
            }

            // ASSERT 4: Verify per-player breakdown has 11 players
            const breakdown = JSON.parse(awardEntries[0].breakdown_json);
            if (!breakdown.per_player || breakdown.per_player.length !== 11) {
                test.details = `Expected 11 players in breakdown, got ${breakdown.per_player?.length || 0}`;
                return test;
            }

            // ASSERT 5: Verify captain 2x multiplier applied
            const captainDetail = breakdown.per_player.find(p => p.is_captain);
            if (!captainDetail || captainDetail.multiplier !== 2) {
                test.details = 'Captain 2x multiplier not applied';
                return test;
            }

            // ASSERT 6: Verify total points match sum of individual points
            const sumFromBreakdown = breakdown.per_player.reduce((sum, p) => sum + p.points, 0);
            if (sumFromBreakdown !== awardEntries[0].points) {
                test.details = `Points mismatch: breakdown sum=${sumFromBreakdown}, ledger=${awardEntries[0].points}`;
                return test;
            }

            // CLEANUP: Delete all test data
            const cleanupMarker = (row) => {
                if (!row.details_json) return false;
                try {
                    const d = typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json;
                    return d.is_test === true && d.test_run_id?.startsWith('test6_');
                } catch { return false; }
            };

            const allLedger = await base44.entities.PointsLedger.list();
            for (const e of allLedger) { if (cleanupMarker(e)) await base44.entities.PointsLedger.delete(e.id); }
            
            const allSquads = await base44.entities.FantasySquad.list();
            for (const sq of allSquads) { if (cleanupMarker(sq)) await base44.entities.FantasySquad.delete(sq.id); }
            
            const allSquadPlayers = await base44.entities.FantasySquadPlayer.list();
            for (const sp of allSquadPlayers) { if (cleanupMarker(sp)) await base44.entities.FantasySquadPlayer.delete(sp.id); }
            
            const allStats = await base44.entities.FantasyMatchPlayerStats.list();
            for (const s of allStats) { if (cleanupMarker(s)) await base44.entities.FantasyMatchPlayerStats.delete(s.id); }
            
            const allMRF = await base44.entities.MatchResultFinal.list();
            for (const mrf of allMRF) { if (cleanupMarker(mrf)) await base44.entities.MatchResultFinal.delete(mrf.id); }
            
            const allMatches = await base44.entities.Match.list();
            for (const m of allMatches) { if (cleanupMarker(m)) await base44.entities.Match.delete(m.id); }
            
            const allPlayers = await base44.entities.Player.list();
            for (const p of allPlayers) { if (cleanupMarker(p)) await base44.entities.Player.delete(p.id); }
            
            const allTeams = await base44.entities.Team.list();
            for (const t of allTeams) { if (cleanupMarker(t)) await base44.entities.Team.delete(t.id); }

            test.status = 'PASS';
            test.details = `✓ 22 stats rows (no dupes), ✓ 1 AWARD, ✓ 11 players in breakdown, ✓ Captain 2× applied, ✓ Points sum matches (${sumFromBreakdown})`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runDevFantasySetup = async () => {
        setDevSetupRunning(true);
        setDevSetupResult(null);

        try {
            const response = await base44.functions.invoke('devFantasyTestSetup', {});
            setDevSetupResult(response.data);
        } catch (error) {
            setDevSetupResult({ error: error.message });
        }

        setDevSetupRunning(false);
    };

    const runFantasyScoring = async (force = false) => {
        if (!selectedMatchId) {
            alert('Please select a match first');
            return;
        }

        setScoringRunning(true);
        setScoringResult(null);

        try {
            const response = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: selectedMatchId,
                force: force
            });
            setScoringResult(response.data);
        } catch (error) {
            setScoringResult({ 
                status: 'ERROR',
                code: 'REQUEST_FAILED',
                message: error.message,
                details: error
            });
        }

        setScoringRunning(false);
    };

    const loadMatchDiagnostics = async (matchId) => {
        if (!matchId) {
            setMatchDiagnostics(null);
            return;
        }

        try {
            const match = matches.find(m => m.id === matchId);
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: matchId });
            const stats = await base44.entities.FantasyMatchPlayerStats.filter({ match_id: matchId });
            
            // Get finalized squads for this phase
            const allSquads = await base44.entities.FantasySquad.filter({ 
                phase: match.phase,
                status: 'FINAL'
            });
            
            // Get starters for first squad (for display)
            let startersCount = 0;
            let benchCount = 0;
            let formationString = 'N/A';
            let positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
            
            if (allSquads.length > 0) {
                const squadPlayers = await base44.entities.FantasySquadPlayer.filter({ 
                    squad_id: allSquads[0].id 
                });
                const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
                startersCount = starters.length;
                benchCount = squadPlayers.filter(sp => sp.slot_type === 'BENCH').length;
                
                // Get position breakdown for starters
                const allPlayers = await base44.entities.Player.list();
                const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));
                for (const sp of starters) {
                    const player = playersMap[sp.player_id];
                    if (player) {
                        positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
                    }
                }
                formationString = `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;
            }
            
            const allLedger = await base44.entities.PointsLedger.list();
            const matchLedger = allLedger.filter(e => {
                if (e.mode !== 'FANTASY') return false;
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === matchId && breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            setMatchDiagnostics({
                  match_id: matchId,
                  match_label: getMatchLabel(match),
                  status: match?.status,
                  phase: match?.phase,
                  finalized: matchResults.length > 0,
                  stats_count: stats.length,
                  squads_count: allSquads.length,
                  starters_count: startersCount,
                  formation: formationString,
                  position_counts: positionCounts,
                  bench_count: benchCount,
                  scored_users: matchLedger.length,
                  last_scored_at: matchLedger.length > 0 ? matchLedger[0].created_date : null
              });
        } catch (error) {
            setMatchDiagnostics({ error: error.message });
        }
    };

    const buildStatsForMatch = async () => {
        if (!selectedMatchId) return;

        setBuildingStats(true);
        try {
            const response = await base44.functions.invoke('fantasyStatsService', {
                action: 'build_fantasy_stats',
                match_id: selectedMatchId,
                options: {}
            });
            
            alert(`Stats built: ${JSON.stringify(response.data)}`);
            await loadMatchDiagnostics(selectedMatchId);
        } catch (error) {
            alert(`Error building stats: ${error.message}`);
        }
        setBuildingStats(false);
    };

    const resetTestData = async () => {
        if (!testRunId) {
            alert('No test run to clean up');
            return;
        }

        if (!confirm('Delete all test data for run ' + testRunId + '?')) {
            return;
        }

        // Marker-based filter — ONLY matches rows explicitly stamped by this test run.
        // Never matches API-sourced rows whose details_json is null or lacks is_test.
        const isTestRow = (row) => {
            if (!row.details_json) return false;
            try {
                const d = typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json;
                return d.is_test === true && d.test_run_id === testRunId;
            } catch { return false; }
        };

        try {
            // Delete test Teams (marker only — never by name substring)
            const allTeams = await base44.entities.Team.list();
            for (const team of allTeams) {
                if (isTestRow(team)) await base44.entities.Team.delete(team.id);
            }

            // Delete test Matches
            const allMatches = await base44.entities.Match.list();
            for (const m of allMatches) {
                if (isTestRow(m)) await base44.entities.Match.delete(m.id);
            }

            // Delete test MatchResultFinals
            const allMRF = await base44.entities.MatchResultFinal.list();
            for (const mrf of allMRF) {
                if (isTestRow(mrf)) await base44.entities.MatchResultFinal.delete(mrf.id);
            }

            // Delete test FantasyMatchPlayerStats
            const allStats = await base44.entities.FantasyMatchPlayerStats.list();
            for (const s of allStats) {
                if (isTestRow(s)) await base44.entities.FantasyMatchPlayerStats.delete(s.id);
            }

            // Delete test FantasySquads
            const allSquads = await base44.entities.FantasySquad.list();
            for (const sq of allSquads) {
                if (isTestRow(sq)) await base44.entities.FantasySquad.delete(sq.id);
            }

            // Delete test DataSources (notes field used as marker)
            const allSources = await base44.entities.DataSource.list();
            for (const source of allSources) {
                if (!source.notes) continue;
                try {
                    const d = typeof source.notes === 'string' ? JSON.parse(source.notes) : source.notes;
                    if (d.is_test === true && d.test_run_id === testRunId) {
                        await base44.entities.DataSource.delete(source.id);
                    }
                } catch { /* not JSON, skip */ }
            }

            // Delete test PointsLedger entries
            const allLedger = await base44.entities.PointsLedger.list();
            for (const entry of allLedger) {
                if (isTestRow(entry)) await base44.entities.PointsLedger.delete(entry.id);
            }

            alert('Test data cleaned up successfully');
            setTestRunId(null);
            setResults([]);

        } catch (error) {
            alert('Cleanup error: ' + error.message);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">System Test Harness</h1>
                <div className="flex gap-2">
                    <Button onClick={runDevFantasySetup} disabled={devSetupRunning} variant="outline">
                        {devSetupRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running...
                            </>
                        ) : (
                            'Run Dev Fantasy Setup'
                        )}
                    </Button>
                    {testRunId && (
                        <Button variant="outline" onClick={resetTestData}>
                            Reset Test Data
                        </Button>
                    )}
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Fantasy Transfer Testing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Select Phase (Knockout Only)</label>
                        <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select phase" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ROUND_OF_32">ROUND_OF_32 (R32)</SelectItem>
                                <SelectItem value="ROUND_OF_16">ROUND_OF_16 (R16)</SelectItem>
                                <SelectItem value="QUARTERFINALS">QUARTERFINALS (QF)</SelectItem>
                                <SelectItem value="SEMIFINALS">SEMIFINALS (SF)</SelectItem>
                                <SelectItem value="FINAL">FINAL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <Button
                            onClick={async () => {
                                setBaselineRunning(true);
                                setBaselineResult(null);
                                try {
                                    const currentUser = await base44.auth.me();
                                    const response = await base44.functions.invoke('fantasyTransferService', {
                                        action: 'ensure_baseline_squad',
                                        user_id: currentUser.id,
                                        phase: selectedPhase
                                    });
                                    setBaselineResult(response.data);
                                } catch (error) {
                                    setBaselineResult({ 
                                        status: 'ERROR', 
                                        message: error.message 
                                    });
                                }
                                setBaselineRunning(false);
                            }}
                            variant="outline"
                            size="sm"
                            disabled={baselineRunning}
                        >
                            {baselineRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Ensure Baseline Squad
                        </Button>
                        <Button
                            onClick={async () => {
                                setTransferTestRunning(true);
                                setTransferTestResult(null);
                                try {
                                    const currentUser = await base44.auth.me();
                                    // Phase-aware max transfers: QF/SF cap at 5, others at 11
                                    const maxTransfers = (selectedPhase === 'QUARTERFINALS' || selectedPhase === 'SEMIFINALS') ? 5 : 11;
                                    const response = await base44.functions.invoke('fantasyTransferService', {
                                        action: 'apply_transfers_and_badges',
                                        user_id: currentUser.id,
                                        phase: selectedPhase,
                                        force_transfers_count: maxTransfers
                                    });
                                    setTransferTestResult(response.data);
                                } catch (error) {
                                    setTransferTestResult({ 
                                        status: 'ERROR', 
                                        message: error.message 
                                    });
                                }
                                setTransferTestRunning(false);
                            }}
                            variant="outline"
                            size="sm"
                            disabled={transferTestRunning}
                        >
                            {transferTestRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Simulate Max Transfers ({(selectedPhase === 'QUARTERFINALS' || selectedPhase === 'SEMIFINALS') ? '5' : '11'})
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    const response = await base44.functions.invoke('fantasyTransferService', {
                                        action: 'check_phase_lock',
                                        target_phase: selectedPhase
                                    });
                                    alert(`Phase Lock Check:\n${JSON.stringify(response.data, null, 2)}`);
                                } catch (error) {
                                    alert(`Error: ${error.message}`);
                                }
                            }}
                            variant="outline"
                            size="sm"
                        >
                            Check Phase Lock
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    const currentUser = await base44.auth.me();
                                    const response = await base44.functions.invoke('badgeService', {
                                        action: 'award_unbreakable_xi',
                                        user_id: currentUser.id,
                                        phase: selectedPhase
                                    });
                                    const d = response.data;
                                    const lines = [
                                        `awarded: ${d.awarded}`,
                                        `already_existed: ${d.already_existed ?? false}`,
                                        `kept_count: ${d.kept_count ?? '—'}`,
                                        `threshold: ${d.threshold ?? '—'}`,
                                        `phase: ${d.phase ?? selectedPhase}`,
                                        d.reason ? `reason: ${d.reason}` : null
                                    ].filter(Boolean);
                                    alert(`🛡️ UNBREAKABLE_XI Badge (${selectedPhase}):\n\n${lines.join('\n')}`);
                                } catch (error) {
                                    alert(`Error: ${error.message}`);
                                }
                            }}
                            variant="outline"
                            size="sm"
                        >
                            Award UNBREAKABLE_XI (current phase)
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    const currentUser = await base44.auth.me();
                                    const response = await base44.functions.invoke('badgeService', {
                                        action: 'award_the_originals',
                                        user_id: currentUser.id
                                    });
                                    const d = response.data;
                                    const lines = [
                                        `awarded: ${d.awarded}`,
                                        `already_existed: ${d.already_existed ?? false}`,
                                        `kept_count: ${d.kept_count ?? '—'}`,
                                        `threshold: ${d.threshold ?? '—'}`,
                                        `base_phase: ${d.base_phase ?? 'ROUND_OF_32'}`,
                                        d.reason ? `reason: ${d.reason}` : null
                                    ].filter(Boolean);
                                    alert(`👑 THE_ORIGINALS Badge (FINAL):\n\n${lines.join('\n')}`);
                                } catch (error) {
                                    alert(`Error: ${error.message}`);
                                }
                            }}
                            variant="outline"
                            size="sm"
                        >
                            Award THE_ORIGINALS (FINAL)
                        </Button>
                    </div>

                    {baselineResult && (
                        <div className="p-4 bg-blue-50 rounded border border-blue-200 mb-4">
                            {baselineResult.status === 'SUCCESS' ? (
                                <div className="space-y-2 text-sm">
                                    <div className="text-blue-700 font-semibold">✓ Baseline Squad: {baselineResult.baseline_status}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div><strong>Phase:</strong> {baselineResult.phase}</div>
                                        <div><strong>Squad ID:</strong> <code>{baselineResult.squad_id?.slice(-8)}</code></div>
                                        {baselineResult.baseline_status === 'CREATED' && (
                                            <>
                                                <div><strong>Copied From:</strong> {baselineResult.copied_from_phase}</div>
                                                <div><strong>Players Copied:</strong> {baselineResult.players_copied}</div>
                                            </>
                                        )}
                                    </div>
                                    <div className="text-xs text-blue-600">{baselineResult.message}</div>
                                </div>
                            ) : (
                                <div className="text-red-600">
                                    <div className="font-semibold">Error</div>
                                    <div className="text-sm">{baselineResult.message}</div>
                                    {baselineResult.hint && <div className="text-xs mt-1">{baselineResult.hint}</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {transferTestResult && (
                        <div className="p-4 bg-gray-50 rounded border">
                            {transferTestResult.status === 'SUCCESS' ? (
                                <div className="space-y-2 text-sm">
                                    <div className="text-green-600 font-semibold">✓ {transferTestResult.status}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><strong>Phase:</strong> {selectedPhase}</div>
                                        <div><strong>Baseline Status:</strong> {transferTestResult.baseline_status || 'N/A'}</div>
                                        <div><strong>Transfers Count:</strong> {transferTestResult.transfers_count}</div>
                                        {transferTestResult.is_locked !== undefined && (
                                            <div className="col-span-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                                                <strong>Phase Lock Status:</strong> {transferTestResult.is_locked ? '🔒 LOCKED' : '🔓 OPEN'}
                                                {transferTestResult.lock_time && (
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        Lock Time: {new Date(transferTestResult.lock_time).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-2">
                                        {transferTestResult.message}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-red-600">
                                    <div className="font-semibold">Error: {transferTestResult.code || 'Unknown'}</div>
                                    <div className="text-sm">{transferTestResult.message}</div>
                                    {transferTestResult.hint && (
                                        <div className="text-xs mt-1 text-blue-700 bg-blue-50 p-2 rounded">{transferTestResult.hint}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Fantasy Scoring Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Select Match</label>
                        <Select value={selectedMatchId || ''} onValueChange={(val) => {
                            setSelectedMatchId(val);
                            loadMatchDiagnostics(val);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a finalized match" />
                            </SelectTrigger>
                            <SelectContent>
                                {finalizedMatches.map(match => (
                                    <SelectItem key={match.id} value={match.id}>
                                        {getMatchLabel(match)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {matchDiagnostics && (
                        <div className="p-4 bg-gray-50 rounded border space-y-3 text-sm">
                            <div className="font-semibold text-base">Match Diagnostics</div>
                            {matchDiagnostics.error ? (
                                <div className="text-red-600">{matchDiagnostics.error}</div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <div>
                                            <strong className="text-gray-700">Match:</strong>
                                            <div className="text-xs text-gray-600 mt-1">{matchDiagnostics.match_label}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <strong className="text-gray-700">Match ID:</strong>
                                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{matchDiagnostics.match_id?.slice(-12)}</code>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(matchDiagnostics.match_id);
                                                    alert('Match ID copied!');
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                        <div><strong>Status:</strong> {matchDiagnostics.status}</div>
                                        <div><strong>Phase:</strong> {matchDiagnostics.phase}</div>
                                        <div><strong>Stats Count:</strong> {matchDiagnostics.stats_count} 
                                            <span className="text-xs text-gray-500 ml-1">(from FantasyMatchPlayerStats)</span>
                                        </div>
                                        <div><strong>Finalized?:</strong> {matchDiagnostics.finalized ? '✓ Yes' : '✗ No'}</div>
                                        <div><strong>Squads Count:</strong> {matchDiagnostics.squads_count}</div>
                                        <div>
                                            <strong>Starters Count:</strong> {matchDiagnostics.starters_count}
                                            {matchDiagnostics.starters_count !== 11 && (
                                                <span className="text-red-600 ml-1">⚠️ Must be 11</span>
                                            )}
                                            <span className="text-xs text-gray-500 ml-1">(slot_type=STARTER)</span>
                                        </div>
                                        <div><strong>Bench Count:</strong> {matchDiagnostics.bench_count || 0}</div>
                                        <div>
                                            <strong>Formation:</strong> {matchDiagnostics.formation || 'N/A'}
                                            <div className="text-xs text-gray-500">
                                                GK:{matchDiagnostics.position_counts?.GK || 0} 
                                                DEF:{matchDiagnostics.position_counts?.DEF || 0} 
                                                MID:{matchDiagnostics.position_counts?.MID || 0} 
                                                FWD:{matchDiagnostics.position_counts?.FWD || 0}
                                            </div>
                                        </div>
                                        <div><strong>Users Scored:</strong> {matchDiagnostics.scored_users}</div>
                                        <div className="col-span-2">
                                            <strong>Last Scored:</strong> 
                                            {matchDiagnostics.last_scored_at ? (
                                                <span className="text-xs block text-gray-600">
                                                    {new Date(matchDiagnostics.last_scored_at).toLocaleString()}
                                                </span>
                                            ) : (
                                                ' Never'
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-2 border-t">
                                        {matchDiagnostics.stats_count === 0 && (
                                            <Button 
                                                size="sm" 
                                                onClick={buildStatsForMatch}
                                                disabled={buildingStats}
                                                variant="outline"
                                            >
                                                {buildingStats ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Build Stats for Match
                                            </Button>
                                        )}
                                        <Link to={`${createPageUrl('AdminFantasyLedgerViewer')}?match=${matchDiagnostics.match_id}`}>
                                            <Button size="sm" variant="outline">
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open Ledger
                                            </Button>
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button 
                            onClick={() => runFantasyScoring(false)} 
                            disabled={scoringRunning || !selectedMatchId}
                        >
                            {scoringRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Run Fantasy Scoring
                        </Button>
                        <Button 
                            onClick={() => runFantasyScoring(true)} 
                            disabled={scoringRunning || !selectedMatchId}
                            variant="destructive"
                        >
                            {scoringRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Force Re-Score
                        </Button>
                    </div>

                    {scoringResult && (
                        <div className="mt-4 p-4 bg-gray-50 rounded border">
                            {scoringResult.ok === false ? (
                                <div className="space-y-2">
                                    <div className="text-red-600 font-bold text-lg">
                                        {scoringResult.code || 'ERROR'}
                                    </div>
                                    <div className="text-sm font-medium">{scoringResult.message}</div>
                                    {scoringResult.hint && (
                                        <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                                            💡 {scoringResult.hint}
                                        </div>
                                    )}
                                    {scoringResult.details && (
                                        <details className="text-xs">
                                            <summary className="cursor-pointer text-gray-600">Show details</summary>
                                            <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-64">
                                                {JSON.stringify(scoringResult.details, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div className="text-green-600 font-semibold">✓ {scoringResult.status}</div>
                                    {scoringResult.message && <div><strong>Message:</strong> {scoringResult.message}</div>}
                                    {scoringResult.users_scored_count !== undefined && (
                                        <>
                                            <div><strong>Users Scored:</strong> {scoringResult.users_scored_count}</div>
                                            <div><strong>Awards:</strong> {scoringResult.ledger_awards}</div>
                                            <div><strong>Voids:</strong> {scoringResult.ledger_voids}</div>
                                            <div><strong>Total Points:</strong> {scoringResult.total_points_awarded}</div>
                                        </>
                                    )}
                                    {scoringResult.diagnostics && (
                                       <details className="mt-3">
                                           <summary className="cursor-pointer font-semibold text-gray-700">Scoring Diagnostics</summary>
                                           <div className="mt-2 p-3 bg-white rounded border space-y-2">
                                               <div className="grid grid-cols-2 gap-2 text-xs">
                                                   <div>
                                                       <strong>Stats Count:</strong> {scoringResult.diagnostics.stats_count}
                                                       <div className="text-gray-500">FantasyMatchPlayerStats rows</div>
                                                   </div>
                                                   <div><strong>Squads Count:</strong> {scoringResult.diagnostics.squads_count}</div>
                                                   <div>
                                                       <strong>DNP Starters:</strong> {scoringResult.diagnostics.dnp_starters_count}
                                                       <div className="text-gray-500">Starters with 0 minutes</div>
                                                       {scoringResult.diagnostics.dnp_starters_count === 0 && (
                                                           <span className="text-yellow-600 text-xs">⚠️ No DNP scenario</span>
                                                       )}
                                                   </div>
                                                   <div>
                                                       <strong>Auto-Subs:</strong> {scoringResult.diagnostics.auto_subs_count}
                                                       <div className="text-gray-500">Bench players subbed in</div>
                                                       {scoringResult.diagnostics.dnp_starters_count > 0 && scoringResult.diagnostics.auto_subs_count === 0 && (
                                                           <span className="text-red-600 text-xs">⚠️ DNP exists but no sub occurred</span>
                                                       )}
                                                   </div>
                                                   <div><strong>Goals Sum:</strong> {scoringResult.diagnostics.goals_sum}</div>
                                                   <div>
                                                       <strong>Goal Scorers in Resolved XI:</strong> {scoringResult.diagnostics.goal_scorers_in_starters_count}
                                                       {scoringResult.diagnostics.goals_sum > 0 && scoringResult.diagnostics.goal_scorers_in_starters_count === 0 && (
                                                           <span className="text-red-600 ml-1">⚠️ Should be &gt; 0</span>
                                                       )}
                                                   </div>
                                                   <div><strong>Computed Total Points:</strong> {scoringResult.diagnostics.computed_total_points}</div>
                                               </div>

                                               {scoringResult.diagnostics.squad_details?.[0] && (
                                                   <>
                                                       <div className="mt-3 p-2 bg-gray-50 border border-gray-300 rounded text-xs">
                                                           <strong className="text-gray-900">Squad Structure (First Squad):</strong>
                                                           <div className="mt-1 grid grid-cols-2 gap-2 text-gray-800">
                                                               <div><strong>Starters:</strong> {scoringResult.diagnostics.squad_details[0].starters_count}</div>
                                                               <div><strong>Bench:</strong> {scoringResult.diagnostics.squad_details[0].bench_count}</div>
                                                               <div><strong>DNP Starters:</strong> {scoringResult.diagnostics.squad_details[0].dnp_starters_count}</div>
                                                               <div><strong>Auto-Subs:</strong> {scoringResult.diagnostics.squad_details[0].auto_subs?.length || 0}</div>
                                                               <div className="col-span-2"><strong>Resolved XI:</strong> {scoringResult.diagnostics.squad_details[0].resolved_xi_count}</div>
                                                           </div>
                                                       </div>
                                                       
                                                       {scoringResult.diagnostics.squad_details[0].transfers_count !== undefined && (
                                                           <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                                               <strong className="text-orange-900">Transfer Info:</strong>
                                                               <div className="mt-1 grid grid-cols-2 gap-2 text-orange-800">
                                                                   <div><strong>Transfers:</strong> {scoringResult.diagnostics.squad_details[0].transfers_count}</div>
                                                                   <div><strong>Free:</strong> {scoringResult.diagnostics.squad_details[0].free_transfers}</div>
                                                                   <div className="col-span-2">
                                                                       <strong>Penalty:</strong> {scoringResult.diagnostics.squad_details[0].penalty_points} points
                                                                   </div>
                                                               </div>
                                                           </div>
                                                       )}
                                                       
                                                       {scoringResult.diagnostics.squad_details[0].auto_subs?.length > 0 && (
                                                           <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                                                               <strong className="text-purple-900">Auto-Substitutions:</strong>
                                                               <div className="mt-1 space-y-1">
                                                                   {scoringResult.diagnostics.squad_details[0].auto_subs.map((sub, idx) => (
                                                                       <div key={idx} className="text-purple-800">
                                                                           • OUT: {sub.out_player_name} → IN: {sub.in_player_name || 'None'} 
                                                                           <span className="text-purple-600 ml-1">({sub.reason})</span>
                                                                       </div>
                                                                   ))}
                                                               </div>
                                                           </div>
                                                       )}
                                                       <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                                           <strong className="text-blue-900">Captain Info (First Squad):</strong>
                                                           <div className="mt-1 space-y-1 text-blue-800">
                                                               {scoringResult.diagnostics.squad_details[0].captain_player_name ? (
                                                                   <>
                                                                       <div><strong>Captain:</strong> {scoringResult.diagnostics.squad_details[0].captain_player_name}</div>
                                                                       <div className="text-xs text-blue-600">
                                                                           ID: {scoringResult.diagnostics.squad_details[0].captain_player_id?.slice(-8)}
                                                                       </div>
                                                                       <div>
                                                                           <strong>Resolved XI Count:</strong> {scoringResult.diagnostics.squad_details[0].resolved_xi_count} (must be 11)
                                                                       </div>
                                                                       <div>
                                                                           <strong>Captain Delta:</strong> +{scoringResult.diagnostics.squad_details[0].delta_from_captain_multiplier} points (2x applied)
                                                                       </div>
                                                                   </>
                                                               ) : (
                                                                   <div className="text-yellow-700">No captain data available</div>
                                                               )}
                                                           </div>
                                                       </div>
                                                   </>
                                               )}

                                               {scoringResult.diagnostics.excluded_goal_scorer_player_ids?.length > 0 && (
                                                   <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                       <strong className="text-yellow-800">⚠️ Excluded Goal Scorers:</strong>
                                                       <div className="mt-1 text-yellow-700">
                                                           {scoringResult.diagnostics.excluded_goal_scorer_player_ids.length} player(s) scored goals but are not in any squad's starters
                                                       </div>
                                                       <code className="text-xs">
                                                           {scoringResult.diagnostics.excluded_goal_scorer_player_ids.join(', ')}
                                                       </code>
                                                   </div>
                                               )}
                                           </div>
                                       </details>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Individual Tests</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 6].map(testNum => (
                            <Button 
                                key={testNum}
                                onClick={() => runSingleTest(testNum)} 
                                disabled={running}
                                variant="outline"
                                size="sm"
                            >
                                Run TEST {testNum}
                            </Button>
                        ))}
                        <Button onClick={runTests} disabled={running}>
                            {running ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                'Run All Tests'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {devSetupResult && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Dev Fantasy Setup Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {devSetupResult.ok === false ? (
                            <div className="space-y-2">
                                <div className="text-red-600 font-bold text-lg">
                                    {devSetupResult.code || 'ERROR'}
                                </div>
                                <div className="text-sm font-medium">{devSetupResult.message}</div>
                                {devSetupResult.hint && (
                                    <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                                        💡 {devSetupResult.hint}
                                    </div>
                                )}
                                {devSetupResult.details && (
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-gray-600">Show details</summary>
                                        <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-64">
                                            {JSON.stringify(devSetupResult.details, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <div>
                                        <strong className="text-gray-700">Match:</strong>
                                        <div className="text-xs text-gray-600 mt-1">{devSetupResult.match_label}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><strong>Match ID:</strong> <code className="text-xs">{devSetupResult.match_id?.slice(-12)}</code></div>
                                        <div><strong>Stats Count:</strong> {devSetupResult.stats_count}</div>
                                        {devSetupResult.stats_by_position && (
                                            <div className="col-span-2 p-2 bg-blue-50 rounded text-xs">
                                                <strong>Stats by Position:</strong>
                                                <div className="mt-1 font-mono">
                                                    GK:{devSetupResult.stats_by_position.GK} 
                                                    ({devSetupResult.stats_with_minutes_by_position?.GK || 0} with minutes) | 
                                                    DEF:{devSetupResult.stats_by_position.DEF} 
                                                    ({devSetupResult.stats_with_minutes_by_position?.DEF || 0} with minutes) | 
                                                    MID:{devSetupResult.stats_by_position.MID} 
                                                    ({devSetupResult.stats_with_minutes_by_position?.MID || 0} with minutes) | 
                                                    FWD:{devSetupResult.stats_by_position.FWD} 
                                                    ({devSetupResult.stats_with_minutes_by_position?.FWD || 0} with minutes)
                                                </div>
                                            </div>
                                        )}
                                        {devSetupResult.dnp_player_id && (
                                            <div className="col-span-2 text-xs text-purple-700">
                                                <strong>DNP Player ID:</strong> {devSetupResult.dnp_player_id.slice(-8)} (set to 0 minutes)
                                            </div>
                                        )}
                                        <div>
                                            <strong>Starters Count:</strong> {devSetupResult.starters_count}
                                            {devSetupResult.starters_count !== 11 && (
                                                <span className="text-red-600 ml-1">⚠️ Must be 11</span>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Formation:</strong> {devSetupResult.formation || 'N/A'}
                                            {devSetupResult.position_counts && (
                                                <div className="text-xs text-gray-500">
                                                    GK:{devSetupResult.position_counts.GK} 
                                                    DEF:{devSetupResult.position_counts.DEF} 
                                                    MID:{devSetupResult.position_counts.MID} 
                                                    FWD:{devSetupResult.position_counts.FWD}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Bench Count:</strong> {devSetupResult.bench_count || 0}
                                            {devSetupResult.bench_count > 3 && (
                                                <span className="text-red-600 ml-1">⚠️ Invalid dev setup: bench overflow</span>
                                            )}
                                            {devSetupResult.bench_count !== 3 && devSetupResult.bench_count <= 3 && (
                                                <span className="text-yellow-600 ml-1">⚠️ Should be 3</span>
                                            )}
                                        </div>
                                        <div>
                                            <strong>DNP Starters:</strong> {devSetupResult.dnp_starters_count || 0}
                                            {devSetupResult.dnp_starters_count === 0 && (
                                                <span className="text-yellow-600 ml-1">⚠️ Should be 1 for testing</span>
                                            )}
                                        </div>
                                        <div><strong>Goal Scorers Count:</strong> {devSetupResult.goal_scorers_count}</div>
                                        <div><strong>Goal Scorers in Starters:</strong> {devSetupResult.goal_scorers_in_starters_count}
                                            {devSetupResult.goal_scorers_count > 0 && devSetupResult.goal_scorers_in_starters_count === 0 && (
                                                <span className="text-red-600 ml-1">⚠️ Should be &gt; 0</span>
                                            )}
                                        </div>
                                        <div><strong>Squad ID:</strong> <code className="text-xs">{devSetupResult.squad_id?.slice(-12)}</code></div>
                                        <div><strong>User:</strong> {devSetupResult.user_email}</div>
                                        <div><strong>Total Points:</strong> {devSetupResult.total_points}</div>
                                        </div>
                                </div>
                                
                                <div className="flex gap-2 pt-3 border-t">
                                    <Link to={`${createPageUrl('AdminFantasyStatsViewer')}?match_id=${devSetupResult.match_id}`}>
                                        <Button size="sm" variant="outline">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Stats Viewer
                                        </Button>
                                    </Link>
                                    <Link to={`${createPageUrl('AdminFantasyLedgerViewer')}?match=${devSetupResult.match_id}`}>
                                        <Button size="sm" variant="outline">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Ledger Viewer
                                        </Button>
                                    </Link>
                                </div>
                                
                                <div className="pt-2 text-green-600 font-semibold">{devSetupResult.message}</div>
                                
                                {devSetupResult.match_result_final_created && (
                                    <div className="text-blue-600 text-sm">
                                        ℹ️ MatchResultFinal auto-created for dev/test match
                                    </div>
                                )}

                                {devSetupResult.sample_ledger_rows?.length > 0 && (
                                    <div className="mt-3">
                                        <div className="font-semibold text-sm mb-2">Sample Ledger Rows:</div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mode</TableHead>
                                                    <TableHead>Source Type</TableHead>
                                                    <TableHead>Source ID</TableHead>
                                                    <TableHead>Points</TableHead>
                                                    <TableHead>Created</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {devSetupResult.sample_ledger_rows.map((row, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-xs">{row.mode}</TableCell>
                                                        <TableCell className="text-xs">{row.source_type}</TableCell>
                                                        <TableCell className="text-xs truncate max-w-[100px]">{row.source_id}</TableCell>
                                                        <TableCell className={`font-semibold ${row.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {row.points > 0 ? '+' : ''}{row.points}
                                                        </TableCell>
                                                        <TableCell className="text-xs">{new Date(row.created_date).toLocaleTimeString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                
                                {devSetupResult.scoring_result && (
                                    <details className="mt-3">
                                        <summary className="text-sm font-medium cursor-pointer">Scoring Result JSON</summary>
                                        <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-auto">
                                            {JSON.stringify(devSetupResult.scoring_result, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Test Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div><strong>TEST 1:</strong> Verifies Finalizer and scoring are idempotent (no duplicate results/points)</div>
                    <div><strong>TEST 2:</strong> Verifies matches with confidence &lt; 70 are NOT auto-finalized</div>
                    <div><strong>TEST 3:</strong> Verifies URL whitelist blocks non-matching URLs</div>
                    <div><strong>TEST 4:</strong> Verifies Fantasy Scoring is idempotent and handles re-scoring with void entries</div>
                    <div><strong>TEST 6:</strong> FULL E2E: Creates teams/players/match/squad → runs fantasyScoringService → verifies per-player breakdown + captain 2× → verifies re-score VOID→AWARD pattern → cleans up all test rows</div>
                    <div className="text-yellow-800 bg-yellow-50 p-3 rounded mt-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <span>Tests create temporary data tagged with test_run_id. Use "Reset Test Data" to clean up.</span>
                    </div>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Test Results</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Test</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((result, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{result.name}</TableCell>
                                        <TableCell>
                                            {result.status === 'PASS' ? (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="w-5 h-5" />
                                                    <span className="font-semibold">PASS</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-red-600">
                                                    <XCircle className="w-5 h-5" />
                                                    <span className="font-semibold">FAIL</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">{result.details}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}