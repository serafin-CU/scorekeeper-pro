import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validation Service - Centralized server-side validation utilities
 * 
 * All write operations must be validated server-side.
 * This service provides reusable validation functions and a unified validation endpoint.
 * 
 * Endpoints:
 * - POST { action: "validate_match" } - Validate match data before creation
 * - POST { action: "validate_score_entry" } - Validate score entry before creation
 * - POST { action: "validate_url_whitelist" } - Validate URL whitelist entry
 * - POST { action: "validate_idempotency_key" } - Check if idempotency key already used
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'validate_match':
                return await validateMatch(base44, user, body);
            case 'validate_score_entry':
                return await validateScoreEntry(base44, user, body);
            case 'validate_url_whitelist':
                return await validateUrlWhitelist(base44, user, body);
            case 'validate_idempotency_key':
                return await validateIdempotencyKey(base44, user, body);
            case 'check_duplicate':
                return await checkDuplicate(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Validation service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Validate match data
 */
async function validateMatch(base44, user, body) {
    const { match_data } = body;
    const errors = [];
    const warnings = [];

    if (!match_data) {
        return Response.json({ 
            valid: false, 
            errors: ['match_data is required'] 
        });
    }

    const { match_id, participant_ids, winner_id, result_data, source_url, is_external_source } = match_data;

    // Required field validation
    if (!match_id || typeof match_id !== 'string') {
        errors.push('match_id is required and must be a string');
    } else if (match_id.length < 3 || match_id.length > 100) {
        errors.push('match_id must be between 3 and 100 characters');
    }

    if (!participant_ids || !Array.isArray(participant_ids)) {
        errors.push('participant_ids is required and must be an array');
    } else {
        if (participant_ids.length < 2) {
            errors.push('participant_ids must contain at least 2 participants');
        }
        if (participant_ids.length > 100) {
            errors.push('participant_ids cannot exceed 100 participants');
        }
        const uniqueIds = new Set(participant_ids);
        if (uniqueIds.size !== participant_ids.length) {
            errors.push('participant_ids contains duplicate entries');
        }
        for (const id of participant_ids) {
            if (typeof id !== 'string') {
                errors.push('All participant_ids must be strings');
                break;
            }
        }
    }

    // Winner validation
    if (winner_id) {
        if (typeof winner_id !== 'string') {
            errors.push('winner_id must be a string');
        } else if (participant_ids && !participant_ids.includes(winner_id)) {
            errors.push('winner_id must be one of the participant_ids');
        }
    }

    // External source validation
    if (is_external_source && !source_url) {
        errors.push('source_url is required when is_external_source is true');
    }

    if (source_url) {
        try {
            new URL(source_url);
        } catch (e) {
            errors.push('source_url must be a valid URL');
        }

        if (is_external_source) {
            const urlCheck = await checkUrlAgainstWhitelist(base44, source_url);
            if (!urlCheck.allowed) {
                errors.push('source_url is not in the approved whitelist');
            }
        }
    }

    // Check for duplicate match_id
    if (match_id && errors.length === 0) {
        const existing = await base44.asServiceRole.entities.MatchResult.filter({ match_id });
        if (existing.length > 0) {
            errors.push(`Match with ID '${match_id}' already exists`);
        }
    }

    // Result data validation (optional but structured)
    if (result_data && typeof result_data !== 'object') {
        errors.push('result_data must be an object');
    }

    return Response.json({ 
        valid: errors.length === 0,
        errors,
        warnings
    });
}

/**
 * Validate score entry data
 */
async function validateScoreEntry(base44, user, body) {
    const { score_data } = body;
    const errors = [];
    const warnings = [];

    if (!score_data) {
        return Response.json({ 
            valid: false, 
            errors: ['score_data is required'] 
        });
    }

    const { user_id, points, reason, source_type, source_id, idempotency_key } = score_data;

    // Required field validation
    if (!user_id || typeof user_id !== 'string') {
        errors.push('user_id is required and must be a string');
    }

    if (typeof points !== 'number' || isNaN(points)) {
        errors.push('points is required and must be a number');
    } else {
        if (points > 10000 || points < -10000) {
            warnings.push('points value is unusually large (>10000 or <-10000)');
        }
    }

    if (!reason || typeof reason !== 'string') {
        errors.push('reason is required and must be a string');
    } else if (reason.length > 500) {
        errors.push('reason cannot exceed 500 characters');
    }

    const validSourceTypes = ['match_result', 'manual_adjustment', 'bonus', 'penalty', 'system_correction'];
    if (!source_type || !validSourceTypes.includes(source_type)) {
        errors.push(`source_type is required and must be one of: ${validSourceTypes.join(', ')}`);
    }

    // Admin-only source types
    if (['manual_adjustment', 'system_correction'].includes(source_type) && user.role !== 'admin') {
        errors.push('Only admins can create manual_adjustment or system_correction entries');
    }

    if (!idempotency_key || typeof idempotency_key !== 'string') {
        errors.push('idempotency_key is required and must be a string');
    } else if (idempotency_key.length > 200) {
        errors.push('idempotency_key cannot exceed 200 characters');
    }

    // Check for existing idempotency key
    if (idempotency_key && errors.length === 0) {
        const existing = await base44.asServiceRole.entities.ScoreLedger.filter({ idempotency_key });
        if (existing.length > 0) {
            warnings.push('Entry with this idempotency_key already exists (will be treated as idempotent)');
        }
    }

    // Validate source_id reference if provided
    if (source_id && source_type === 'match_result') {
        const matches = await base44.asServiceRole.entities.MatchResult.filter({ id: source_id });
        if (matches.length === 0) {
            warnings.push('source_id does not reference an existing match');
        }
    }

    return Response.json({ 
        valid: errors.length === 0,
        errors,
        warnings
    });
}

/**
 * Validate URL whitelist entry
 */
async function validateUrlWhitelist(base44, user, body) {
    const { whitelist_data } = body;
    const errors = [];
    const warnings = [];

    if (!whitelist_data) {
        return Response.json({ 
            valid: false, 
            errors: ['whitelist_data is required'] 
        });
    }

    const { pattern, pattern_type, name, description } = whitelist_data;

    // Admin check
    if (user.role !== 'admin') {
        errors.push('Only admins can create URL whitelist entries');
    }

    if (!pattern || typeof pattern !== 'string') {
        errors.push('pattern is required and must be a string');
    }

    const validPatternTypes = ['exact', 'prefix', 'regex'];
    if (!pattern_type || !validPatternTypes.includes(pattern_type)) {
        errors.push(`pattern_type is required and must be one of: ${validPatternTypes.join(', ')}`);
    }

    // Validate regex if applicable
    if (pattern_type === 'regex' && pattern) {
        try {
            new RegExp(pattern);
        } catch (e) {
            errors.push('Invalid regex pattern: ' + e.message);
        }
    }

    // Validate exact/prefix are valid URL-like
    if (pattern && (pattern_type === 'exact' || pattern_type === 'prefix')) {
        if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) {
            warnings.push('Pattern should typically start with http:// or https://');
        }
    }

    if (!name || typeof name !== 'string') {
        errors.push('name is required and must be a string');
    } else if (name.length > 100) {
        errors.push('name cannot exceed 100 characters');
    }

    // Check for duplicate pattern
    if (pattern && errors.length === 0) {
        const existing = await base44.asServiceRole.entities.UrlWhitelist.filter({ pattern });
        if (existing.length > 0) {
            errors.push('Pattern already exists in whitelist');
        }
    }

    return Response.json({ 
        valid: errors.length === 0,
        errors,
        warnings
    });
}

/**
 * Check if idempotency key has been used
 */
async function validateIdempotencyKey(base44, user, body) {
    const { idempotency_key, entity_type } = body;

    if (!idempotency_key) {
        return Response.json({ error: 'idempotency_key is required' }, { status: 400 });
    }

    let exists = false;
    let existing_entry = null;

    switch (entity_type) {
        case 'ScoreLedger':
            const scoreEntries = await base44.asServiceRole.entities.ScoreLedger.filter({ idempotency_key });
            exists = scoreEntries.length > 0;
            existing_entry = scoreEntries[0] || null;
            break;
        case 'JobExecution':
            const jobEntries = await base44.asServiceRole.entities.JobExecution.filter({ idempotency_key });
            exists = jobEntries.length > 0;
            existing_entry = jobEntries[0] || null;
            break;
        case 'AuditLog':
            const auditEntries = await base44.asServiceRole.entities.AuditLog.filter({ idempotency_key });
            exists = auditEntries.length > 0;
            existing_entry = auditEntries[0] || null;
            break;
        default:
            return Response.json({ error: 'entity_type must be ScoreLedger, JobExecution, or AuditLog' }, { status: 400 });
    }

    return Response.json({ 
        exists,
        existing_entry
    });
}

/**
 * Generic duplicate check
 */
async function checkDuplicate(base44, user, body) {
    const { entity_type, field, value } = body;

    if (!entity_type || !field || value === undefined) {
        return Response.json({ error: 'entity_type, field, and value are required' }, { status: 400 });
    }

    const validEntities = ['MatchResult', 'ScoreLedger', 'UrlWhitelist', 'JobExecution'];
    if (!validEntities.includes(entity_type)) {
        return Response.json({ error: `entity_type must be one of: ${validEntities.join(', ')}` }, { status: 400 });
    }

    const filter = { [field]: value };
    const entries = await base44.asServiceRole.entities[entity_type].filter(filter);

    return Response.json({ 
        exists: entries.length > 0,
        count: entries.length,
        first_match: entries[0] || null
    });
}

/**
 * Check URL against whitelist
 */
async function checkUrlAgainstWhitelist(base44, url) {
    const whitelist = await base44.asServiceRole.entities.UrlWhitelist.filter({ is_active: true });
    
    for (const entry of whitelist) {
        let isMatch = false;
        
        if (entry.pattern_type === 'exact') {
            isMatch = url === entry.pattern;
        } else if (entry.pattern_type === 'prefix') {
            isMatch = url.startsWith(entry.pattern);
        } else if (entry.pattern_type === 'regex') {
            try {
                const regex = new RegExp(entry.pattern);
                isMatch = regex.test(url);
            } catch (e) {
                console.error('Invalid regex pattern:', entry.pattern, e);
            }
        }

        if (isMatch) {
            return { allowed: true, matchedEntry: entry };
        }
    }

    return { allowed: false, matchedEntry: null };
}