// Safety guard for delete operations - prevents mass deletion with empty/missing filters
export const safeDelete = async (entityName, deleteFn, filter, entityType) => {
    // Guard: reject empty/missing/null/undefined filters
    if (filter === undefined || filter === null) {
        throw new Error(`Refusing to delete ${entityType || entityName}: filter is ${filter}`);
    }
    
    // Check for empty object {}
    if (typeof filter === 'object' && !Array.isArray(filter) && Object.keys(filter).length === 0) {
        throw new Error(`Refusing to delete ${entityType || entityName}: filter is empty object {}`);
    }
    
    // Check for empty array []
    if (Array.isArray(filter) && filter.length === 0) {
        throw new Error(`Refusing to delete ${entityType || entityName}: filter is empty array []`);
    }
    
    // Filter is valid, proceed with delete
    return await deleteFn();
};