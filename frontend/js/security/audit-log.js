/**
 * ESTIF HOME ULTIMATE - AUDIT LOG MODULE
 * Comprehensive logging of security events, user actions, and system changes
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// AUDIT LOG CONFIGURATION
// ============================================

const AuditLogConfig = {
    // Log levels
    levels: {
        debug: { priority: 0, color: '#6c757d' },
        info: { priority: 1, color: '#4cc9f0' },
        warning: { priority: 2, color: '#ffd166' },
        error: { priority: 3, color: '#ef476f' },
        critical: { priority: 4, color: '#d9042b' }
    },
    
    // Categories
    categories: {
        auth: 'Authentication',
        user: 'User Management',
        device: 'Device Control',
        home: 'Home Management',
        security: 'Security',
        system: 'System',
        automation: 'Automation',
        settings: 'Settings'
    },
    
    // Storage
    maxEntries: 10000,
    storageKey: 'estif_audit_log',
    
    // Retention
    retentionDays: 90,
    
    // Export
    exportFormats: ['json', 'csv'],
    
    // Debug
    debug: false
};

// ============================================
// AUDIT ENTRY CLASS
// ============================================

class AuditEntry {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.timestamp = data.timestamp || Date.now();
        this.level = data.level || 'info';
        this.category = data.category || 'system';
        this.action = data.action;
        this.userId = data.userId || null;
        this.userName = data.userName || null;
        this.ip = data.ip || null;
        this.userAgent = data.userAgent || navigator.userAgent;
        this.details = data.details || {};
        this.result = data.result || 'success';
        this.error = data.error || null;
        this.duration = data.duration || null;
    }

    generateId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            level: this.level,
            category: this.category,
            action: this.action,
            userId: this.userId,
            userName: this.userName,
            ip: this.ip,
            userAgent: this.userAgent,
            details: this.details,
            result: this.result,
            error: this.error,
            duration: this.duration
        };
    }

    format() {
        const date = new Date(this.timestamp).toISOString();
        const levelName = this.level.toUpperCase();
        const categoryName = AuditLogConfig.categories[this.category] || this.category;
        
        return `[${date}] [${levelName}] [${categoryName}] ${this.action} - User: ${this.userName || 'system'} - Result: ${this.result}`;
    }
}

// ============================================
// AUDIT LOG MANAGER
// ============================================

class AuditLogManager {
    constructor() {
        this.entries = [];
        this.listeners = [];
        this.filteredEntries = [];
        this.currentFilter = null;
        
        this.init();
    }

    init() {
        this.loadEntries();
        this.cleanOldEntries();
        AuditLogConfig.debug && console.log('[AuditLog] Manager initialized with', this.entries.length, 'entries');
    }

    loadEntries() {
        try {
            const saved = localStorage.getItem(AuditLogConfig.storageKey);
            if (saved) {
                const entries = JSON.parse(saved);
                this.entries = entries.map(e => Object.assign(new AuditEntry(e), e));
            }
        } catch (error) {
            console.error('[AuditLog] Failed to load entries:', error);
        }
    }

    saveEntries() {
        try {
            // Limit entries
            if (this.entries.length > AuditLogConfig.maxEntries) {
                this.entries = this.entries.slice(0, AuditLogConfig.maxEntries);
            }
            localStorage.setItem(AuditLogConfig.storageKey, JSON.stringify(this.entries));
        } catch (error) {
            console.error('[AuditLog] Failed to save entries:', error);
        }
    }

    cleanOldEntries() {
        const cutoff = Date.now() - (AuditLogConfig.retentionDays * 24 * 60 * 60 * 1000);
        const originalCount = this.entries.length;
        this.entries = this.entries.filter(entry => entry.timestamp > cutoff);
        
        if (originalCount !== this.entries.length) {
            this.saveEntries();
            AuditLogConfig.debug && console.log('[AuditLog] Cleaned', originalCount - this.entries.length, 'old entries');
        }
    }

    // ============================================
    // LOGGING METHODS
    // ============================================

    log(level, category, action, details = {}, options = {}) {
        const entry = new AuditEntry({
            level,
            category,
            action,
            details,
            userId: options.userId || this.getCurrentUserId(),
            userName: options.userName || this.getCurrentUserName(),
            ip: options.ip || this.getClientIP(),
            result: options.result || 'success',
            error: options.error || null,
            duration: options.duration || null
        });
        
        this.entries.unshift(entry);
        this.saveEntries();
        
        // Console output for debugging
        if (AuditLogConfig.debug) {
            console.log(`[Audit] ${entry.format()}`);
        }
        
        // Trigger real-time notification for critical events
        if (level === 'critical' || level === 'error') {
            this.notifyListeners('critical_event', entry);
        }
        
        this.notifyListeners('entry_added', entry);
        
        return entry;
    }

    // Convenience methods
    info(category, action, details = {}, options = {}) {
        return this.log('info', category, action, details, options);
    }

    warning(category, action, details = {}, options = {}) {
        return this.log('warning', category, action, details, options);
    }

    error(category, action, details = {}, options = {}) {
        return this.log('error', category, action, details, options);
    }

    critical(category, action, details = {}, options = {}) {
        return this.log('critical', category, action, details, options);
    }

    debug(category, action, details = {}, options = {}) {
        return this.log('debug', category, action, details, options);
    }

    // ============================================
    // SPECIFIC EVENT LOGGERS
    // ============================================

    logLogin(userId, userName, success, details = {}) {
        return this.log(
            success ? 'info' : 'warning',
            'auth',
            'user_login',
            { ...details, success },
            { userId, userName, result: success ? 'success' : 'failed' }
        );
    }

    logLogout(userId, userName) {
        return this.log('info', 'auth', 'user_logout', {}, { userId, userName });
    }

    logDeviceControl(userId, userName, deviceId, action, state) {
        return this.log('info', 'device', 'device_control', {
            deviceId,
            action,
            state
        }, { userId, userName });
    }

    logSettingsChange(userId, userName, setting, oldValue, newValue) {
        return this.log('info', 'settings', 'settings_change', {
            setting,
            oldValue,
            newValue
        }, { userId, userName });
    }

    logSecurityEvent(event, details = {}) {
        return this.log('warning', 'security', event, details);
    }

    logError(category, action, error, details = {}) {
        return this.log('error', category, action, { ...details, error: error.message }, { result: 'failed', error: error.message });
    }

    // ============================================
    // QUERY METHODS
    // ============================================

    getEntries(limit = 100, offset = 0) {
        return this.entries.slice(offset, offset + limit);
    }

    getEntriesByLevel(level, limit = 100) {
        return this.entries.filter(e => e.level === level).slice(0, limit);
    }

    getEntriesByCategory(category, limit = 100) {
        return this.entries.filter(e => e.category === category).slice(0, limit);
    }

    getEntriesByUser(userId, limit = 100) {
        return this.entries.filter(e => e.userId === userId).slice(0, limit);
    }

    getEntriesByDateRange(startDate, endDate, limit = 100) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        return this.entries.filter(e => e.timestamp >= start && e.timestamp <= end).slice(0, limit);
    }

    searchEntries(query, limit = 100) {
        const lowerQuery = query.toLowerCase();
        return this.entries.filter(e => 
            e.action.toLowerCase().includes(lowerQuery) ||
            e.category.toLowerCase().includes(lowerQuery) ||
            (e.userName && e.userName.toLowerCase().includes(lowerQuery)) ||
            JSON.stringify(e.details).toLowerCase().includes(lowerQuery)
        ).slice(0, limit);
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStatistics() {
        const stats = {
            total: this.entries.length,
            byLevel: {},
            byCategory: {},
            byResult: { success: 0, failed: 0 },
            last24Hours: 0,
            last7Days: 0,
            uniqueUsers: new Set()
        };
        
        const now = Date.now();
        const dayAgo = now - 86400000;
        const weekAgo = now - 604800000;
        
        for (const entry of this.entries) {
            // By level
            stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
            
            // By category
            stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
            
            // By result
            if (entry.result === 'success') stats.byResult.success++;
            else stats.byResult.failed++;
            
            // Time ranges
            if (entry.timestamp > dayAgo) stats.last24Hours++;
            if (entry.timestamp > weekAgo) stats.last7Days++;
            
            // Unique users
            if (entry.userId) stats.uniqueUsers.add(entry.userId);
        }
        
        stats.uniqueUsers = stats.uniqueUsers.size;
        
        return stats;
    }

    // ============================================
    // EXPORT/IMPORT
    // ============================================

    exportData(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.entries, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'level', 'category', 'action', 'userId', 'userName', 'result', 'error', 'details'];
            const rows = this.entries.map(entry => [
                new Date(entry.timestamp).toISOString(),
                entry.level,
                entry.category,
                entry.action,
                entry.userId || '',
                entry.userName || '',
                entry.result,
                entry.error || '',
                JSON.stringify(entry.details)
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        return null;
    }

    importData(data, format = 'json') {
        try {
            let entries;
            if (format === 'json') {
                entries = JSON.parse(data);
            } else if (format === 'csv') {
                // Parse CSV (simplified)
                const lines = data.split('\n');
                const headers = lines[0].split(',');
                entries = lines.slice(1).map(line => {
                    const values = line.split(',');
                    const entry = {};
                    headers.forEach((header, i) => {
                        entry[header] = values[i];
                    });
                    return entry;
                });
            }
            
            for (const entryData of entries) {
                const entry = new AuditEntry(entryData);
                this.entries.push(entry);
            }
            
            this.saveEntries();
            this.notifyListeners('data_imported', { count: entries.length });
            return true;
        } catch (error) {
            console.error('[AuditLog] Import failed:', error);
            return false;
        }
    }

    clearEntries() {
        this.entries = [];
        this.saveEntries();
        this.notifyListeners('entries_cleared');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.id || null;
    }

    getCurrentUserName() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.name || null;
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return null;
        }
    }

    getLevelColor(level) {
        return AuditLogConfig.levels[level]?.color || '#6c757d';
    }

    getLevelName(level) {
        return level.toUpperCase();
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// AUDIT LOG UI COMPONENT
// ============================================

class AuditLogUI {
    constructor(auditManager) {
        this.auditManager = auditManager;
        this.currentFilter = null;
        this.currentPage = 1;
        this.pageSize = 50;
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        AuditLogConfig.debug && console.log('[AuditLogUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('audit-log-container');
        if (!container) return;

        container.innerHTML = `
            <div class="audit-log-panel">
                <div class="audit-header">
                    <i class="fas fa-history"></i>
                    <h3>Audit Log</h3>
                    <button id="export-log" class="btn btn-sm btn-primary">
                        <i class="fas fa-download"></i> Export
                    </button>
                    <button id="clear-log" class="btn btn-sm btn-danger">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                </div>
                
                <div class="audit-stats" id="audit-stats"></div>
                
                <div class="audit-filters">
                    <select id="filter-level" class="filter-select">
                        <option value="">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                        <option value="critical">Critical</option>
                    </select>
                    <select id="filter-category" class="filter-select">
                        <option value="">All Categories</option>
                        ${Object.entries(AuditLogConfig.categories).map(([key, name]) => `
                            <option value="${key}">${name}</option>
                        `).join('')}
                    </select>
                    <input type="text" id="filter-search" placeholder="Search..." class="filter-search">
                    <button id="apply-filters" class="btn btn-secondary">Apply</button>
                    <button id="reset-filters" class="btn btn-secondary">Reset</button>
                </div>
                
                <div class="audit-entries" id="audit-entries"></div>
                
                <div class="audit-pagination" id="audit-pagination"></div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('audit-stats');
        this.entriesContainer = document.getElementById('audit-entries');
        this.paginationContainer = document.getElementById('audit-pagination');
        this.filterLevel = document.getElementById('filter-level');
        this.filterCategory = document.getElementById('filter-category');
        this.filterSearch = document.getElementById('filter-search');
        this.applyFiltersBtn = document.getElementById('apply-filters');
        this.resetFiltersBtn = document.getElementById('reset-filters');
        this.exportBtn = document.getElementById('export-log');
        this.clearBtn = document.getElementById('clear-log');
    }

    bindUIEvents() {
        if (this.applyFiltersBtn) {
            this.applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }
        
        if (this.resetFiltersBtn) {
            this.resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }
        
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportLog());
        }
        
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearLog());
        }
    }

    bindEvents() {
        this.auditManager.addEventListener('entry_added', () => this.render());
        this.auditManager.addEventListener('entries_cleared', () => this.render());
        this.auditManager.addEventListener('data_imported', () => this.render());
    }

    render() {
        this.renderStats();
        this.renderEntries();
        this.renderPagination();
    }

    renderStats() {
        const stats = this.auditManager.getStatistics();
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.last24Hours}</div>
                <div class="stat-label">Last 24h</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.last7Days}</div>
                <div class="stat-label">Last 7 days</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.uniqueUsers}</div>
                <div class="stat-label">Unique Users</div>
            </div>
        `;
    }

    renderEntries() {
        let entries = this.getFilteredEntries();
        const start = (this.currentPage - 1) * this.pageSize;
        const paginatedEntries = entries.slice(start, start + this.pageSize);
        
        if (paginatedEntries.length === 0) {
            this.entriesContainer.innerHTML = '<div class="no-entries">No audit entries found</div>';
            return;
        }
        
        this.entriesContainer.innerHTML = paginatedEntries.map(entry => `
            <div class="audit-entry ${entry.level}" data-entry-id="${entry.id}">
                <div class="entry-header">
                    <span class="entry-time">${new Date(entry.timestamp).toLocaleString()}</span>
                    <span class="entry-level" style="color: ${this.auditManager.getLevelColor(entry.level)}">
                        ${this.auditManager.getLevelName(entry.level)}
                    </span>
                    <span class="entry-category">${AuditLogConfig.categories[entry.category] || entry.category}</span>
                    <span class="entry-result ${entry.result}">${entry.result}</span>
                </div>
                <div class="entry-body">
                    <div class="entry-action">${this.escapeHtml(entry.action)}</div>
                    <div class="entry-details">
                        ${entry.userName ? `<span class="entry-user"><i class="fas fa-user"></i> ${this.escapeHtml(entry.userName)}</span>` : ''}
                        ${entry.ip ? `<span class="entry-ip"><i class="fas fa-network-wired"></i> ${entry.ip}</span>` : ''}
                        ${entry.duration ? `<span class="entry-duration"><i class="fas fa-clock"></i> ${entry.duration}ms</span>` : ''}
                    </div>
                    ${entry.error ? `<div class="entry-error"><i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(entry.error)}</div>` : ''}
                    ${Object.keys(entry.details).length > 0 ? `
                        <details class="entry-details-raw">
                            <summary>View Details</summary>
                            <pre>${JSON.stringify(entry.details, null, 2)}</pre>
                        </details>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderPagination() {
        const entries = this.getFilteredEntries();
        const totalPages = Math.ceil(entries.length / this.pageSize);
        
        if (totalPages <= 1) {
            this.paginationContainer.innerHTML = '';
            return;
        }
        
        let paginationHtml = '<div class="pagination">';
        
        // Previous button
        paginationHtml += `<button class="page-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Next button
        paginationHtml += `<button class="page-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
        paginationHtml += '</div>';
        
        this.paginationContainer.innerHTML = paginationHtml;
        
        // Bind pagination events
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderEntries();
                    this.renderPagination();
                }
            });
        });
    }

    getFilteredEntries() {
        let entries = this.auditManager.entries;
        
        if (this.currentFilter) {
            if (this.currentFilter.level) {
                entries = entries.filter(e => e.level === this.currentFilter.level);
            }
            if (this.currentFilter.category) {
                entries = entries.filter(e => e.category === this.currentFilter.category);
            }
            if (this.currentFilter.search) {
                const search = this.currentFilter.search.toLowerCase();
                entries = entries.filter(e => 
                    e.action.toLowerCase().includes(search) ||
                    (e.userName && e.userName.toLowerCase().includes(search)) ||
                    JSON.stringify(e.details).toLowerCase().includes(search)
                );
            }
        }
        
        return entries;
    }

    applyFilters() {
        this.currentFilter = {
            level: this.filterLevel.value || null,
            category: this.filterCategory.value || null,
            search: this.filterSearch.value || null
        };
        this.currentPage = 1;
        this.render();
    }

    resetFilters() {
        this.filterLevel.value = '';
        this.filterCategory.value = '';
        this.filterSearch.value = '';
        this.currentFilter = null;
        this.currentPage = 1;
        this.render();
    }

    exportLog() {
        const format = confirm('Export as CSV? (OK for CSV, Cancel for JSON)') ? 'csv' : 'json';
        const data = this.auditManager.exportData(format);
        
        const blob = new Blob([data], { type: `application/${format}` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    clearLog() {
        if (confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
            this.auditManager.clearEntries();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// CSS STYLES
// ============================================

const auditLogStyles = `
    .audit-log-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .audit-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .audit-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .audit-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .audit-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .stat-card {
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
    }
    
    .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: var(--primary);
    }
    
    .stat-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }
    
    .audit-filters {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }
    
    .filter-select, .filter-search {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .filter-search {
        flex: 1;
        min-width: 200px;
    }
    
    .audit-entries {
        max-height: 500px;
        overflow-y: auto;
    }
    
    .audit-entry {
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
        border-left: 4px solid;
    }
    
    .audit-entry.info { border-left-color: #4cc9f0; }
    .audit-entry.warning { border-left-color: #ffd166; }
    .audit-entry.error { border-left-color: #ef476f; }
    .audit-entry.critical { border-left-color: #d9042b; }
    
    .entry-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-tertiary);
        font-size: 12px;
    }
    
    .entry-time {
        color: var(--text-muted);
    }
    
    .entry-level {
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .entry-category {
        background: var(--bg-primary);
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .entry-result {
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .entry-result.success {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .entry-result.failed {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .entry-body {
        padding: 12px 16px;
    }
    
    .entry-action {
        font-weight: 500;
        margin-bottom: 8px;
    }
    
    .entry-details {
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .entry-error {
        margin-top: 8px;
        padding: 8px;
        background: var(--danger-soft);
        border-radius: 4px;
        color: var(--danger);
        font-size: 12px;
    }
    
    .entry-details-raw {
        margin-top: 8px;
    }
    
    .entry-details-raw summary {
        cursor: pointer;
        color: var(--primary);
        font-size: 11px;
    }
    
    .entry-details-raw pre {
        margin-top: 8px;
        padding: 8px;
        background: var(--bg-primary);
        border-radius: 4px;
        font-size: 10px;
        overflow-x: auto;
    }
    
    .audit-pagination {
        display: flex;
        justify-content: center;
        margin-top: 16px;
    }
    
    .pagination {
        display: flex;
        gap: 4px;
    }
    
    .page-btn {
        padding: 6px 12px;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .page-btn.active {
        background: var(--primary);
        color: white;
    }
    
    .page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .no-entries {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = auditLogStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const auditLog = new AuditLogManager();
const auditLogUI = new AuditLogUI(auditLog);

// Exports
window.auditLog = auditLog;
window.auditLogUI = auditLogUI;
window.AuditLogManager = AuditLogManager;

export { auditLog, auditLogUI, AuditLogManager, AuditLogConfig };