import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Audit Service - Query and manage audit logs
 * 
 * Audit logs are immutable - once created, they cannot be modified or deleted.
 * This service provides read-only access and admin utilities.
 * 
 * Endpoints:
 * - POST { action: "query_logs" } - Query audit logs with filters
 * - POST { action: "get_security_events" } - Get security-related events
 * - POST { action: "get_user_activity" } - Get activity for a specific user
 * - POST { action: "get_entity_history" } - Get history for a specific entity
 * - POST { action: "export_logs" } - Export logs for compliance (admin only)
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
            case 'query_logs':
                return await queryLogs(base44, user, body);
            case 'get_security_events':
                return await getSecurityEvents(base44, user, body);
            case 'get_user_activity':
                return await getUserActivity(base44, user, body);
            case 'get_entity_history':
                return await getEntityHistory(base44, user, body);
            case 'export_logs':
                return await exportLogs(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Audit service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Query audit logs with filters
 */
async function queryLogs(base44, user, body) {
    const { 
        action_filter,
        actor_id,
        entity_type,
        severity,
        start_date,
        end_date,
        success_only,
        limit
    } = body;

    // Non-admin users can only see their own activity
    const effectiveActorId = user.role !== 'admin' ? user.id : actor_id;

    let logs = await base44.asServiceRole.entities.AuditLog.list('-created_date', limit || 100);

    // Apply filters
    logs = logs.filter(log => {
        if (action_filter && !log.action.includes(action_filter)) return false;
        if (effectiveActorId && log.actor_id !== effectiveActorId) return false;
        if (entity_type && log.entity_type !== entity_type) return false;
        if (severity && log.severity !== severity) return false;
        if (start_date && log.created_date < start_date) return false;
        if (end_date && log.created_date > end_date) return false;
        if (success_only !== undefined && log.success !== success_only) return false;
        return true;
    });

    return Response.json({ 
        success: true, 
        logs,
        total: logs.length 
    });
}

/**
 * Get security-related events (warnings, errors, unauthorized attempts)
 */
async function getSecurityEvents(base44, user, body) {
    // Admin only
    if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { start_date, end_date, limit } = body;

    let logs = await base44.asServiceRole.entities.AuditLog.list('-created_date', limit || 200);

    // Filter for security events
    const securityActions = [
        'unauthorized',
        'blocked',
        'void',
        'failed',
        'invalid',
        'denied'
    ];

    logs = logs.filter(log => {
        // Include warnings and errors
        if (log.severity === 'warning' || log.severity === 'error' || log.severity === 'critical') {
            if (start_date && log.created_date < start_date) return false;
            if (end_date && log.created_date > end_date) return false;
            return true;
        }
        // Include specific security-related actions
        if (securityActions.some(action => log.action.toLowerCase().includes(action))) {
            if (start_date && log.created_date < start_date) return false;
            if (end_date && log.created_date > end_date) return false;
            return true;
        }
        return false;
    });

    // Group by action type for summary
    const summary = {};
    for (const log of logs) {
        const key = log.action;
        if (!summary[key]) {
            summary[key] = { count: 0, severity_counts: {} };
        }
        summary[key].count++;
        summary[key].severity_counts[log.severity] = (summary[key].severity_counts[log.severity] || 0) + 1;
    }

    return Response.json({ 
        success: true, 
        logs,
        total: logs.length,
        summary
    });
}

/**
 * Get activity for a specific user
 */
async function getUserActivity(base44, user, body) {
    const { target_user_id, limit } = body;

    // Non-admin users can only see their own activity
    const effectiveUserId = user.role !== 'admin' ? user.id : (target_user_id || user.id);

    const logs = await base44.asServiceRole.entities.AuditLog.filter(
        { actor_id: effectiveUserId },
        '-created_date',
        limit || 50
    );

    // Also get actions that affected this user (as entity_id in certain contexts)
    const scoreEntries = await base44.asServiceRole.entities.ScoreLedger.filter({
        user_id: effectiveUserId
    });

    // Get match results where user participated
    const allMatches = await base44.asServiceRole.entities.MatchResult.list();
    const userMatches = allMatches.filter(m => m.participant_ids?.includes(effectiveUserId));

    return Response.json({ 
        success: true, 
        activity_logs: logs,
        score_entries: scoreEntries,
        match_results: userMatches,
        total_logs: logs.length
    });
}

/**
 * Get history for a specific entity
 */
async function getEntityHistory(base44, user, body) {
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
        return Response.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
    }

    const logs = await base44.asServiceRole.entities.AuditLog.filter({
        entity_type,
        entity_id
    }, '-created_date', 100);

    // Build a timeline
    const timeline = logs.map(log => ({
        timestamp: log.created_date,
        action: log.action,
        actor: log.actor_id,
        actor_type: log.actor_type,
        success: log.success,
        details: log.details
    }));

    return Response.json({ 
        success: true, 
        entity_type,
        entity_id,
        timeline,
        total_events: logs.length
    });
}

/**
 * Export logs for compliance (admin only)
 */
async function exportLogs(base44, user, body) {
    // Admin only
    if (user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'audit_export_unauthorized',
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            success: false,
            error_message: 'Non-admin attempted to export audit logs'
        });
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { start_date, end_date, entity_type } = body;

    if (!start_date || !end_date) {
        return Response.json({ error: 'start_date and end_date are required for export' }, { status: 400 });
    }

    let logs = await base44.asServiceRole.entities.AuditLog.list('-created_date', 10000);

    // Apply date range filter
    logs = logs.filter(log => {
        if (log.created_date < start_date) return false;
        if (log.created_date > end_date) return false;
        if (entity_type && log.entity_type !== entity_type) return false;
        return true;
    });

    // Log the export action
    await createAuditLog(base44, {
        action: 'audit_logs_exported',
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'info',
        details: { 
            start_date, 
            end_date, 
            entity_type,
            records_exported: logs.length
        },
        success: true
    });

    return Response.json({ 
        success: true, 
        logs,
        export_metadata: {
            exported_by: user.id,
            exported_at: new Date().toISOString(),
            start_date,
            end_date,
            entity_type: entity_type || 'all',
            total_records: logs.length
        }
    });
}

/**
 * Create an audit log entry
 */
async function createAuditLog(base44, data) {
    try {
        await base44.asServiceRole.entities.AuditLog.create(data);
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
}