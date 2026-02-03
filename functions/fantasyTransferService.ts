import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fantasy Transfer Service
 * Handles transfer detection, validation, penalties, and phase locks
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({
                status: 'ERROR',
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }, { status: 401 });
        }

        const { action, squad_id, target_phase, force_transfers_count } = await req.json();

        if (action === 'calculate_transfers') {
            const result = await calculateTransfers(base44, user.id, squad_id, target_phase);
            return Response.json(result);
        }

        if (action === 'check_phase_lock') {
            const result = await checkPhaseLock(base44, target_phase);
            return Response.json(result);
        }

        if (action === 'apply_transfer_penalties') {
            const result = await applyTransferPenalties(base44, user.id, target_phase, force_transfers_count);
            return Response.json(result);
        }

        return Response.json({
            status: 'ERROR',
            code: 'INVALID_ACTION',
            message: 'Invalid action specified'
        }, { status: 400 });

    } catch (error) {
        console.error('Fantasy transfer service error:', error);
        return Response.json({
            status: 'ERROR',
            code: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            details: {
                name: error.name,
                stack: error.stack
            }
        }, { status: 500 });
    }
});

/**
 * Check if a phase is locked based on cutoff time
 */
async function checkPhaseLock(base44, phase) {
    // Get first match of the phase
    const phaseMatches = await base44.asServiceRole.entities.Match.filter({ phase });
    
    if (phaseMatches.length === 0) {
        return {
            status: 'SUCCESS',
            is_locked: false,
            reason: 'No matches found for phase'
        };
    }

    // Sort by kickoff time
    const sortedMatches = phaseMatches.sort((a, b) => 
        new Date(a.kickoff_at) - new Date(b.kickoff_at)
    );

    const firstMatch = sortedMatches[0];
    const firstMatchTime = new Date(firstMatch.kickoff_at);
    const lockTime = new Date(firstMatchTime.getTime() - (48 * 60 * 60 * 1000)); // 48 hours before
    const now = new Date();

    const isLocked = now >= lockTime;

    return {
        status: 'SUCCESS',
        is_locked: isLocked,
        lock_time: lockTime.toISOString(),
        first_match_time: firstMatchTime.toISOString(),
        current_time: now.toISOString(),
        hours_until_lock: isLocked ? 0 : Math.floor((lockTime - now) / (1000 * 60 * 60))
    };
}

/**
 * Calculate transfers between current squad and previous phase squad
 */
async function calculateTransfers(base44, user_id, current_squad_id, current_phase) {
    // Get current squad
    const currentSquad = await base44.asServiceRole.entities.FantasySquad.get(current_squad_id);
    if (!currentSquad) {
        return {
            status: 'ERROR',
            code: 'SQUAD_NOT_FOUND',
            message: 'Current squad not found'
        };
    }

    // Get previous phase
    const phaseOrder = ['PRE_TOURNAMENT', 'GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];
    const currentPhaseIndex = phaseOrder.indexOf(current_phase);
    
    if (currentPhaseIndex <= 0) {
        return {
            status: 'SUCCESS',
            transfers_count: 0,
            free_transfers: 0,
            penalty_points: 0,
            changed_player_ids: [],
            message: 'First phase - no transfers calculated'
        };
    }

    const previousPhase = phaseOrder[currentPhaseIndex - 1];

    // Get previous phase squad
    const previousSquads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase: previousPhase,
        status: 'FINAL'
    });

    if (previousSquads.length === 0) {
        return {
            status: 'SUCCESS',
            transfers_count: 0,
            free_transfers: 0,
            penalty_points: 0,
            changed_player_ids: [],
            message: 'No previous phase squad found'
        };
    }

    const previousSquad = previousSquads[0];

    // Get player IDs from both squads
    const currentPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: current_squad_id
    });
    const previousPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: previousSquad.id
    });

    const currentPlayerIds = new Set(currentPlayers.map(p => p.player_id));
    const previousPlayerIds = new Set(previousPlayers.map(p => p.player_id));

    // Calculate transfers (players that differ)
    const changedPlayerIds = [];
    for (const playerId of currentPlayerIds) {
        if (!previousPlayerIds.has(playerId)) {
            changedPlayerIds.push(playerId);
        }
    }
    for (const playerId of previousPlayerIds) {
        if (!currentPlayerIds.has(playerId)) {
            changedPlayerIds.push(playerId);
        }
    }

    const transfersCount = Math.floor(changedPlayerIds.length / 2); // Each transfer = 1 out + 1 in

    // Get transfer rules for phase
    const rules = getTransferRules(current_phase);
    const freeTransfers = rules.free_transfers;
    const excessTransfers = Math.max(0, transfersCount - freeTransfers);

    // Calculate penalty
    let penaltyPoints = 0;
    if (excessTransfers > 0) {
        penaltyPoints = calculatePenalty(current_phase, transfersCount, freeTransfers);
    }

    return {
        status: 'SUCCESS',
        transfers_count: transfersCount,
        free_transfers: freeTransfers,
        excess_transfers: excessTransfers,
        penalty_points: penaltyPoints,
        changed_player_ids: changedPlayerIds,
        previous_phase: previousPhase,
        current_phase: current_phase,
        rules: rules
    };
}

/**
 * Get transfer rules for a phase
 */
function getTransferRules(phase) {
    const rules = {
        'ROUND_OF_16': {
            free_transfers: 3,
            tier1_limit: 6,
            tier1_penalty: -2,
            tier2_penalty: -3
        },
        'QUARTERFINALS': {
            free_transfers: 2,
            tier1_limit: 5,
            tier1_penalty: -4,
            tier2_penalty: null
        },
        'SEMIFINALS': {
            free_transfers: 2,
            tier1_limit: 5,
            tier1_penalty: -5,
            tier2_penalty: null
        },
        'FINAL': {
            free_transfers: Infinity,
            tier1_limit: Infinity,
            tier1_penalty: 0,
            tier2_penalty: null
        }
    };

    return rules[phase] || {
        free_transfers: 0,
        tier1_limit: 0,
        tier1_penalty: 0,
        tier2_penalty: null
    };
}

/**
 * Calculate penalty points based on phase and transfers
 */
function calculatePenalty(phase, transfersCount, freeTransfers) {
    const rules = getTransferRules(phase);
    const excessTransfers = transfersCount - freeTransfers;

    if (excessTransfers <= 0) return 0;

    let penalty = 0;
    const breakdown = [];

    if (phase === 'ROUND_OF_16') {
        // Transfers 4-6: -2 each, Transfers 7-11: -3 each
        const tier1Count = Math.min(excessTransfers, rules.tier1_limit - freeTransfers);
        const tier2Count = Math.max(0, excessTransfers - tier1Count);

        if (tier1Count > 0) {
            penalty += tier1Count * rules.tier1_penalty;
            breakdown.push(`${tier1Count} transfers × ${rules.tier1_penalty} = ${tier1Count * rules.tier1_penalty}`);
        }
        if (tier2Count > 0) {
            penalty += tier2Count * rules.tier2_penalty;
            breakdown.push(`${tier2Count} transfers × ${rules.tier2_penalty} = ${tier2Count * rules.tier2_penalty}`);
        }
    } else if (phase === 'QUARTERFINALS' || phase === 'SEMIFINALS') {
        // All excess transfers at same rate
        penalty = excessTransfers * rules.tier1_penalty;
        breakdown.push(`${excessTransfers} transfers × ${rules.tier1_penalty} = ${penalty}`);
    }

    return penalty;
}

/**
 * Apply transfer penalties to ledger
 */
async function applyTransferPenalties(base44, user_id, phase, forceTransfersCount = null) {
    // Check if penalty already exists for this user + phase
    const existingPenalties = await base44.asServiceRole.entities.PointsLedger.filter({
        user_id,
        mode: 'PENALTY',
        source_type: 'TRANSFER_PENALTY'
    });

    const phaseAlreadyPenalized = existingPenalties.some(p => {
        try {
            const breakdown = JSON.parse(p.breakdown_json);
            return breakdown.phase === phase;
        } catch {
            return false;
        }
    });

    if (phaseAlreadyPenalized && !forceTransfersCount) {
        return {
            status: 'ERROR',
            code: 'PENALTY_ALREADY_APPLIED',
            message: 'Transfer penalty already applied for this phase'
        };
    }

    // Get current squad for phase
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase,
        status: 'FINAL'
    });

    if (squads.length === 0) {
        return {
            status: 'ERROR',
            code: 'NO_SQUAD',
            message: 'No finalized squad found for phase'
        };
    }

    // Calculate transfers
    const transferResult = await calculateTransfers(base44, user_id, squads[0].id, phase);

    if (transferResult.status !== 'SUCCESS') {
        return transferResult;
    }

    let penaltyPoints = transferResult.penalty_points;
    let transfersCount = transferResult.transfers_count;

    // Override for testing
    if (forceTransfersCount !== null && forceTransfersCount !== undefined) {
        transfersCount = forceTransfersCount;
        const rules = getTransferRules(phase);
        penaltyPoints = calculatePenalty(phase, forceTransfersCount, rules.free_transfers);
    }

    if (penaltyPoints >= 0) {
        return {
            status: 'SUCCESS',
            penalty_applied: false,
            message: 'No penalty to apply',
            transfers_count: transfersCount,
            free_transfers: transferResult.free_transfers,
            penalty_points: 0
        };
    }

    // Create penalty ledger entry
    await base44.asServiceRole.entities.PointsLedger.create({
        user_id,
        mode: 'PENALTY',
        source_type: 'TRANSFER_PENALTY',
        source_id: `TRANSFER:${phase}`,
        points: penaltyPoints,
        breakdown_json: JSON.stringify({
            type: 'TRANSFER_PENALTY',
            phase: phase,
            transfers_count: transfersCount,
            free_transfers: transferResult.free_transfers,
            excess_transfers: transferResult.excess_transfers,
            penalty_points: penaltyPoints,
            rules: transferResult.rules,
            timestamp: new Date().toISOString()
        })
    });

    return {
        status: 'SUCCESS',
        penalty_applied: true,
        penalty_points: penaltyPoints,
        transfers_count: transfersCount,
        free_transfers: transferResult.free_transfers,
        excess_transfers: transferResult.excess_transfers,
        message: `Transfer penalty applied: ${penaltyPoints} points`
    };
}