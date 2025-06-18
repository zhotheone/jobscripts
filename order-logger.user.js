// ==UserScript==
// @name         Order Logger (alt + l)
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.1
// @description  The definitive professional tool to log order visits with a virtualized UI, CSV tools, referrer tracking, robust hotkey management, and daily statistics.
// @author       Heorhii Litovskyi (George)
// @match        https://essaycock.com/support/dashboard/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/order-logger.user.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/order-logger.user.js
// ==/UserScript==

(async function() {
    'use strict';

    // =================================================================================
    // --- 1. CONFIGURATION & PERMANENT DATA STORAGE ---
    // =================================================================================
    const SETTINGS_KEY = 'GLOBAL_ORDER_LOGGER_SETTINGS_V1'; // Permanent key
    const LOGS_KEY = 'GLOBAL_ORDER_LOGGER_LOGS_V1';         // Permanent key
    const DEFAULT_SETTINGS = {
        theme: 'rose-pine-moon',
        buttonPosition: 'bottom-right',
        logLimit: 10000,
        noLogOnRefresh: true,
        showToast: true, // New setting
        keybinding: 'alt+KeyL',
        customTheme: { bg: '#2a273f', surface: '#232136', surface_container: '#302d41', primary: '#eb6f92', text: '#e0def4', subtle: '#44415a' }
    };
    let settings = {};
    let logs = [];

    const loadData = async () => {
        settings = { ...DEFAULT_SETTINGS, ...(await GM.getValue(SETTINGS_KEY, DEFAULT_SETTINGS)) };
        settings.customTheme = { ...DEFAULT_SETTINGS.customTheme, ...(settings.customTheme || {}) };
        logs = await GM.getValue(LOGS_KEY, []);
    };
    const saveData = (key, data) => GM.setValue(key, data);

    // =================================================================================
    // --- 2. CORE LOGGING & CSV ---
    // =================================================================================
    const acquireLock = async (timeout = 2000) => {
        const lockKey = 'logger_lock';
        const lockId = Date.now() + Math.random();
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const currentLock = sessionStorage.getItem(lockKey);
            if (!currentLock || Date.now() - parseInt(currentLock) > 5000) {
                sessionStorage.setItem(lockKey, lockId.toString());
                await new Promise(r => setTimeout(r, 50));
                if (sessionStorage.getItem(lockKey) === lockId.toString()) return true;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return false;
    };
    const releaseLock = () => sessionStorage.removeItem('logger_lock');

    const getEnhancedReferrer = () => {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source') || params.get('from') || params.get('ref');
        if (source) {
            return `Opened via: ${source.charAt(0).toUpperCase() + source.slice(1)}`;
        }
        const referrer = document.referrer;
        if (!referrer) return "Direct Visit";
        try {
            const referrerUrl = new URL(referrer);
            return referrerUrl.hostname === window.location.hostname ? referrerUrl.pathname + referrerUrl.search : `External: ${referrerUrl.hostname}`;
        } catch (e) {
            return "Invalid Referrer";
        }
    };

    const logOrderVisit = async () => {
        if (!window.location.pathname.includes('/support/dashboard/orders/')) return;
        const orderIdEl = await waitForElement('#order_bage', 3000);
        if (!orderIdEl) return;

        if (settings.noLogOnRefresh) {
            const visitKey = `lastVisit_${window.location.pathname}`;
            const now = Date.now();
            if (sessionStorage.getItem(visitKey) && (now - parseInt(sessionStorage.getItem(visitKey)) < 5000)) {
                console.log("Logger: Visit skipped (refresh).");
                sessionStorage.setItem(visitKey, now.toString());
                return;
            }
            sessionStorage.setItem(visitKey, now.toString());
        }

        if (!(await acquireLock())) {
            console.error("Logger: Could not acquire lock to save log.");
            return;
        }

        try {
            const currentLogsOnDisk = await GM.getValue(LOGS_KEY, []);
            if (currentLogsOnDisk.length >= settings.logLimit * 0.95) {
                const archiveCount = Math.floor(currentLogsOnDisk.length / 2);
                const toArchive = currentLogsOnDisk.slice(-archiveCount);
                const remaining = currentLogsOnDisk.slice(0, currentLogsOnDisk.length - archiveCount);
                await saveData(LOGS_KEY, remaining);
                if (settings.showToast) showToast("Archiving old logs...", "System");
                downloadCSV(convertToCSV(toArchive), `log_archive_${new Date().toISOString().split('T')[0]}.csv`);
            }

            const getDetail = (label) => {
                const container = document.querySelector('.panel.panel-warning .panel-body');
                if (!container) return 'N/A';
                for (const row of container.querySelectorAll('.row')) {
                    const labelEl = row.children[0];
                    if (labelEl && labelEl.textContent.trim().startsWith(label)) {
                        return labelEl.nextElementSibling?.textContent.trim().replace(/\s+/g, ' ') ?? 'N/A';
                    }
                }
                return 'N/A';
            };

            const logEntry = {
                timestamp: new Date().toISOString(),
                orderId: orderIdEl.textContent.match(/\d+/)?.[0] ?? 'N/A',
                link: window.location.href,
                referrer: getEnhancedReferrer(),
                details: {
                    Status: document.querySelector('.orderStatusesDropdown span span')?.textContent.trim() ?? getDetail('Order status'),
                    Topic: getDetail('Topic'), 'Type of work': getDetail('Type of work'), 'Type of paper': getDetail('Type of paper'),
                    Pages: getDetail('Pages'), Deadline: getDetail('Current deadline'), Price: getDetail('Price'), Writer: getDetail('Writer'),
                }
            };

            currentLogsOnDisk.unshift(logEntry);
            await saveData(LOGS_KEY, currentLogsOnDisk);
            logs = currentLogsOnDisk;
            if (settings.showToast) showToast("Log Saved!", logEntry.orderId);
        } finally {
            releaseLock();
        }
    };

    const convertToCSV = (data) => {
        if (!data || data.length === 0) return "";
        const allDetailKeys = [...new Set(data.flatMap(row => Object.keys(row.details)))];
        const headers = ['timestamp', 'orderId', 'link', 'referrer', ...allDetailKeys];
        const csvRows = data.map(row => {
            const rowData = { ...row, ...row.details };
            return headers.map(fieldName => {
                const value = rowData[fieldName] ?? '';
                let strValue = String(value);
                if (strValue.includes(',')) strValue = `"${strValue.replace(/"/g, '""')}"`;
                return strValue;
            }).join(',');
        });
        return [headers.join(','), ...csvRows].join('\r\n');
    };

    const convertStatsToCSV = (stats) => {
        const sections = [];
        
        // Overall statistics
        sections.push('=== OVERALL STATISTICS ===');
        sections.push('Metric,Value');
        sections.push(`Total Visits,${stats.totalVisits}`);
        sections.push(`Unique Orders,${stats.uniqueOrders}`);
        sections.push(`Date Range,"${stats.dateRange.first.toLocaleDateString()} - ${stats.dateRange.last.toLocaleDateString()}"`);
        sections.push('');
        
        // Daily statistics
        sections.push('=== DAILY VISIT STATISTICS ===');
        sections.push('Date,Total Visits,Unique Orders');
        Object.entries(stats.dailyStats)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .forEach(([dateStr, data]) => {
                const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString();
                sections.push(`${formattedDate},${data.visits},${data.uniqueOrders}`);
            });
        sections.push('');
        
        // Top orders
        sections.push('=== MOST VISITED ORDERS ===');
        sections.push('Order ID,Visit Count');
        stats.topOrders.forEach(([orderId, count]) => {
            sections.push(`${orderId},${count}`);
        });
        sections.push('');
        
        // Status distribution
        sections.push('=== STATUS DISTRIBUTION ===');
        sections.push('Status,Count');
        Object.entries(stats.statusDistribution)
            .sort(([,a], [,b]) => b - a)
            .forEach(([status, count]) => {
                sections.push(`"${status}",${count}`);
            });
        
        return sections.join('\r\n');
    };

    const downloadCSV = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // =================================================================================
    // --- 3. UI & VIRTUALIZATION ---
    // =================================================================================
    const ICONS = {
        logs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>`,
        settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61-.25-1.17-.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19-.15-.24.42-.12.64l2 3.46c.12-.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23-.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        expand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`,
        clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
        export: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
        stats: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`,
        filter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>`,
    };
    let activeDialog = null;
    let uiContainer;

    const createLogsDialog = () => {
        const dialog = document.createElement('div');
        dialog.className = 'm-dialog-container';
        dialog.innerHTML = `<div class="m-scrim" data-action="close"></div>
            <div class="m-dialog">
                <div class="m-dialog-header"><h2 class="m-dialog-title">Order Visit Logs</h2><button class="m-icon-button" data-action="close">${ICONS.close}</button></div>
                <div class="m-dialog-content" id="virtual-log-container"></div>
                <div class="m-dialog-actions">
                    <button class="m-text-button danger" data-action="clear-logs">${ICONS.clear} Clear</button>
                    <button class="m-text-button" data-action="export-csv">${ICONS.export} Export CSV</button>
                    <button class="m-filled-button" data-action="close">Close</button>
                </div>
            </div>`;

        const container = dialog.querySelector('#virtual-log-container');
        if (logs.length === 0) {
            container.innerHTML = '<p class="m-empty-state">No logs recorded yet.</p>';
            return dialog;
        }

        const groupedLogs = logs.reduce((acc, log) => {
            const date = new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[date]) acc[date] = {};
            if (!acc[date][log.orderId]) acc[date][log.orderId] = [];
            acc[date][log.orderId].push(log);
            return acc;
        }, {});

        const sortedDates = Object.keys(groupedLogs).sort((a, b) => new Date(b) - new Date(a));

        const flattenedData = sortedDates.flatMap(date =>
            [{ type: 'date', value: date }, ...Object.values(groupedLogs[date]).sort((a,b) => new Date(b[0].timestamp) - new Date(a[0].timestamp)).map(visits => ({ type: 'order', visits }))]
        );

        let renderedCount = 0;
        const RENDER_CHUNK = 20;
        const renderChunk = () => {
            const fragment = document.createDocumentFragment();
            const chunk = flattenedData.slice(renderedCount, renderedCount + RENDER_CHUNK);
            chunk.forEach(item => {
                if (item.type === 'date') {
                    const el = document.createElement('h3');
                    el.className = 'm-list-subheader';
                    el.textContent = item.value;
                    fragment.appendChild(el);
                } else if (item.type === 'order') {
                    fragment.appendChild(createOrderGroupElement(item.visits));
                }
            });
            container.appendChild(fragment);
            renderedCount += chunk.length;
        };
        container.onscroll = () => { if (container.scrollTop + container.clientHeight >= container.scrollHeight - 200) { renderChunk(); } };
        renderChunk();
        return dialog;
    };

    const createOrderGroupElement = (visits) => {
        const latestVisit = visits[0];
        const prevVisit = visits[1];
        const quickInfo = `Status: ${latestVisit.details.Status} | Pages: ${latestVisit.details.Pages}`;
        const latestTime = new Date(latestVisit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeSinceLastHtml = prevVisit ? `<span class="m-list-item-last-visit">Last visit: ${formatTimeSince(latestVisit.timestamp, prevVisit.timestamp)} ago</span>` : `<span class="m-list-item-last-visit">First visit</span>`;

        const visitsHtml = visits.map((visit, i) => {
            const previousLog = visits[i + 1];
            const timeDiffHtml = previousLog ? `<span class="time-diff">(+ ${formatTimeSince(visit.timestamp, previousLog.timestamp)})</span>` : '';
            const changes = previousLog ? diffDetails(visit.details, previousLog.details) : {};
            const detailsHtml = `<ul class="details-list">
                <li><strong>Came From:</strong> <span>${visit.referrer}</span></li>
                ${Object.entries(visit.details).map(([k, v]) => `<li><strong>${k}:</strong> <span>${v}</span></li>`).join('')}
            </ul>`;
            const changesHtml = Object.keys(changes).length > 0 ? `<ul class="changes-list">${Object.entries(changes).map(([k, v]) => `<li><strong>${k}:</strong> "${v.from}" → "${v.to}"</li>`).join('')}</ul>` : '';
            return `<li><div class="visit-header"><span class="time">${new Date(visit.timestamp).toLocaleTimeString()}</span>${timeDiffHtml}</div>${changesHtml}${detailsHtml}</li>`;
        }).join('');

        const groupEl = document.createElement('div');
        groupEl.className = 'm-list-item-group';
        groupEl.innerHTML = `<div class="m-list-item expandable">
            <div class="m-list-item-content">
                <div class="m-list-item-header">
                    <span class="m-list-item-title"><a href="${latestVisit.link}" target="_blank">Order #${latestVisit.orderId}</a></span>
                    <span class="m-list-item-timestamp">${latestTime}</span>
                </div>
                <div class="m-list-item-footer">
                    <span class="m-list-item-subtitle">${quickInfo}</span>
                    ${timeSinceLastHtml}
                </div>
            </div>
            <div class="m-list-item-meta"><span>${visits.length} visit${visits.length > 1 ? 's' : ''}</span><div class="m-icon-button small">${ICONS.expand}</div></div>
        </div>
        <div class="m-expand-content"><ul>${visitsHtml}</ul></div>`;
        return groupEl;
    };

    const createSettingsDialog = () => {
        const dialog = document.createElement('div'); dialog.className = 'm-dialog-container';
        dialog.innerHTML = `<div class="m-scrim" data-action="close"></div><div class="m-dialog"><div class="m-dialog-header"><h2 class="m-dialog-title">Settings</h2><button class="m-icon-button" data-action="close">${ICONS.close}</button></div><div class="m-dialog-content"><div class="m-setting-row"><label>Theme</label><select id="setting-theme"><option value="rose-pine-moon">Rosé Pine Moon</option><option value="rose-pine-dawn">Rosé Pine Dawn</option><option value="custom">Custom</option></select></div><div id="custom-theme-settings"><label>Custom Colors:</label><div><span>Background</span><input type="color" id="custom-bg" value="${settings.customTheme.bg}"></div><div><span>Surface</span><input type="color" id="custom-surface" value="${settings.customTheme.surface}"></div><div><span>Container</span><input type="color" id="custom-surface_container" value="${settings.customTheme.surface_container}"></div><div><span>Primary</span><input type="color" id="custom-primary" value="${settings.customTheme.primary}"></div><div><span>Text</span><input type="color" id="custom-text" value="${settings.customTheme.text}"></div><div><span>Subtle</span><input type="color" id="custom-subtle" value="${settings.customTheme.subtle}"></div></div><div class="m-setting-row"><label>Button Position</label><select id="setting-position"><option value="bottom-right">Bottom Right</option><option value="bottom-left">Bottom Left</option><option value="top-right">Top Right</option><option value="top-left">Top Left</option></select></div><div class="m-setting-row"><label>Log Limit</label><input type="number" id="setting-loglimit" min="100" max="50000" step="100" value="${settings.logLimit}"></div><div class="m-setting-row"><label>Hotkey</label><div class="m-keybinding-container"><span class="m-keybinding-display" data-keybinding="${settings.keybinding}">${formatKeybinding(settings.keybinding)}</span><button type="button" class="m-keybinding-record">Record New Hotkey</button></div></div><div class="m-setting-row checkbox"><input type="checkbox" id="setting-norefresh"><label for="setting-norefresh">Don't log on refresh</label></div><div class="m-setting-row checkbox"><input type="checkbox" id="setting-showtoast"><label for="setting-showtoast">Show 'Log Saved' notification</label></div></div><div class="m-dialog-actions"><button class="m-text-button" data-action="close">Cancel</button><button class="m-filled-button" data-action="save">Save</button></div></div>`;
        const form = dialog.querySelector('.m-dialog-content'); form.querySelector('#setting-theme').value = settings.theme; form.querySelector('#setting-position').value = settings.buttonPosition; form.querySelector('#setting-norefresh').checked = settings.noLogOnRefresh; form.querySelector('#setting-showtoast').checked = settings.showToast;
        const customThemeDiv = form.querySelector('#custom-theme-settings'); customThemeDiv.style.display = settings.theme === 'custom' ? 'grid' : 'none';
        form.querySelector('#setting-theme').onchange = (e) => { customThemeDiv.style.display = e.target.value === 'custom' ? 'grid' : 'none'; };
        
        // Setup keybinding recorder
        const recordBtn = form.querySelector('.m-keybinding-record');
        const display = form.querySelector('.m-keybinding-display');
        recordBtn.onclick = () => recordKeybinding(display, recordBtn);
        
        return dialog;
    };
    const showToast = (message, detail) => {
        const toast = document.createElement('div'); toast.className = 'm-logger-toast'; toast.innerHTML = `${message}<span>${detail}</span>`; document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 50); setTimeout(() => { toast.classList.remove('visible'); toast.addEventListener('transitionend', () => toast.remove()); }, 3000);
    };
    const toggleDialog = (factory) => { (activeDialog && activeDialog.id === factory.name) ? closeDialog() : openDialog(factory); };
    const openDialog = (factory) => { if (activeDialog) closeDialog(); activeDialog = factory(); activeDialog.id = factory.name; document.body.appendChild(activeDialog); setTimeout(() => activeDialog.classList.add('visible'), 10); };
    const closeDialog = () => { if (!activeDialog) return; activeDialog.classList.remove('visible'); activeDialog.addEventListener('transitionend', () => activeDialog.remove(), { once: true }); activeDialog = null; };

    // =================================================================================
    // --- 4. APP LOGIC & STATE MANAGEMENT ---
    // =================================================================================
    const calculateStatistics = () => {
        if (logs.length === 0) return null;

        const stats = {
            totalVisits: logs.length,
            uniqueOrders: new Set(logs.map(log => log.orderId)).size,
            dateRange: {
                first: new Date(logs[logs.length - 1].timestamp),
                last: new Date(logs[0].timestamp)
            },
            dailyStats: {},
            topOrders: {},
            hourlyDistribution: new Array(24).fill(0),
            statusDistribution: {},
            referrerStats: {}
        };

        // Calculate daily statistics
        logs.forEach(log => {
            const logDate = new Date(log.timestamp);
            const date = logDate.toISOString().split('T')[0]; // Use YYYY-MM-DD format for consistency
            const hour = logDate.getHours();
            const orderId = log.orderId;
            const status = log.details.Status || 'Unknown';
            const referrer = log.referrer;

            // Daily counts
            if (!stats.dailyStats[date]) {
                stats.dailyStats[date] = { visits: 0, uniqueOrders: new Set() };
            }
            stats.dailyStats[date].visits++;
            stats.dailyStats[date].uniqueOrders.add(orderId);

            // Top orders
            stats.topOrders[orderId] = (stats.topOrders[orderId] || 0) + 1;

            // Hourly distribution
            stats.hourlyDistribution[hour]++;

            // Status distribution
            stats.statusDistribution[status] = (stats.statusDistribution[status] || 0) + 1;

            // Referrer statistics
            stats.referrerStats[referrer] = (stats.referrerStats[referrer] || 0) + 1;
        });

        // Convert sets to counts and sort
        Object.keys(stats.dailyStats).forEach(date => {
            stats.dailyStats[date].uniqueOrders = stats.dailyStats[date].uniqueOrders.size;
        });

        stats.topOrders = Object.entries(stats.topOrders)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        stats.referrerStats = Object.entries(stats.referrerStats)
            .sort(([,a], [,b]) => b - a);

        return stats;
    };

    const createStatsDialog = () => {
        const stats = calculateStatistics();
        if (!stats) {
            const dialog = document.createElement('div');
            dialog.className = 'm-dialog-container';
            dialog.innerHTML = `<div class="m-scrim" data-action="close"></div>
                <div class="m-dialog">
                    <div class="m-dialog-header"><h2 class="m-dialog-title">Statistics</h2><button class="m-icon-button" data-action="close">${ICONS.close}</button></div>
                    <div class="m-dialog-content"><p class="m-empty-state">No data available for statistics.</p></div>
                    <div class="m-dialog-actions"><button class="m-filled-button" data-action="close">Close</button></div>
                </div>`;
            return dialog;
        }

        const daysSinceFirst = Math.ceil((stats.dateRange.last - stats.dateRange.first) / (1000 * 60 * 60 * 24)) || 1;
        const avgVisitsPerDay = (stats.totalVisits / daysSinceFirst).toFixed(1);

        // Create daily chart data
        const sortedDates = Object.keys(stats.dailyStats).sort((a, b) => new Date(a) - new Date(b));
        const last7Days = sortedDates.slice(-7);
        const chartData = last7Days.map(dateStr => {
            const date = new Date(dateStr + 'T00:00:00'); // Ensure proper date parsing
            return {
                date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                visits: stats.dailyStats[dateStr].visits,
                orders: stats.dailyStats[dateStr].uniqueOrders
            };
        });

        const maxVisits = Math.max(...chartData.map(d => d.visits));

        const dialog = document.createElement('div');
        dialog.className = 'm-dialog-container';
        dialog.innerHTML = `<div class="m-scrim" data-action="close"></div>
            <div class="m-dialog">
                <div class="m-dialog-header"><h2 class="m-dialog-title">Order Visit Statistics</h2><button class="m-icon-button" data-action="close">${ICONS.close}</button></div>
                <div class="m-dialog-content">
                    <div class="m-stats-overview">
                        <div class="m-stat-card">
                            <div class="m-stat-value">${stats.totalVisits}</div>
                            <div class="m-stat-label">Total Visits</div>
                        </div>
                        <div class="m-stat-card">
                            <div class="m-stat-value">${stats.uniqueOrders}</div>
                            <div class="m-stat-label">Unique Orders</div>
                        </div>
                        <div class="m-stat-card">
                            <div class="m-stat-value">${avgVisitsPerDay}</div>
                            <div class="m-stat-label">Avg/Day</div>
                        </div>
                        <div class="m-stat-card">
                            <div class="m-stat-value">${daysSinceFirst}</div>
                            <div class="m-stat-label">Days Tracked</div>
                        </div>
                    </div>

                    <div class="m-stats-section">
                        <h3>Daily Visits (Last 7 Days)</h3>
                        <div class="m-chart">
                            ${chartData.map(d => `
                                <div class="m-chart-bar">
                                    <div class="m-bar" style="height: ${(d.visits / maxVisits) * 100}%"></div>
                                    <div class="m-bar-label">${d.date}</div>
                                    <div class="m-bar-value">${d.visits} visits<br>${d.orders} orders</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="m-stats-section">
                        <h3>Most Visited Orders</h3>
                        <div class="m-top-list">
                            ${stats.topOrders.slice(0, 5).map(([orderId, count]) => `
                                <div class="m-top-item">
                                    <span class="m-top-name">Order #${orderId}</span>
                                    <span class="m-top-count">${count} visits</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="m-stats-section">
                        <h3>Visit Sources</h3>
                        <div class="m-top-list">
                            ${stats.referrerStats.slice(0, 5).map(([source, count]) => `
                                <div class="m-top-item">
                                    <span class="m-top-name">${source.length > 40 ? source.substring(0, 40) + '...' : source}</span>
                                    <span class="m-top-count">${count} visits</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="m-stats-section">
                        <h3>Status Distribution</h3>
                        <div class="m-top-list">
                            ${Object.entries(stats.statusDistribution).sort(([,a], [,b]) => b - a).slice(0, 5).map(([status, count]) => `
                                <div class="m-top-item">
                                    <span class="m-top-name">${status}</span>
                                    <span class="m-top-count">${count} orders</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="m-dialog-actions">
                    <button class="m-text-button" data-action="export-stats-csv">${ICONS.export} Export Stats</button>
                    <button class="m-filled-button" data-action="close">Close</button>
                </div>
            </div>`;

        return dialog;
    };

    const formatKeybinding = (keybinding) => {
        return keybinding.split('+').map(key => {
            if (key.startsWith('Key')) return key.slice(3).toUpperCase();
            if (key.startsWith('Digit')) return key.slice(5);
            if (key === 'cmd') return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
            if (key === 'ctrl') return 'Ctrl';
            if (key === 'shift') return 'Shift';
            if (key === 'alt') return 'Alt';
            if (key === 'meta') return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Meta';
            return key.charAt(0).toUpperCase() + key.slice(1);
        }).join(' + ');
    };

    const recordKeybinding = (display, recordBtn) => {
        display.textContent = 'Press any key combination...';
        display.className = 'm-keybinding-display recording';
        recordBtn.textContent = 'Recording...';
        recordBtn.disabled = true;
        
        const recordingHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const keys = [];
            if (event.ctrlKey) keys.push('ctrl');
            if (event.metaKey) keys.push(navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'meta');
            if (event.shiftKey) keys.push('shift');
            if (event.altKey) keys.push('alt');
            
            // Use event.code instead of event.key for layout independence
            const keyCode = event.code;
            
            // Only record if there's at least one modifier and a valid key code
            if (keys.length > 0 && keyCode && (
                keyCode.startsWith('Key') || // Letter keys (KeyA, KeyB, etc.)
                keyCode.startsWith('Digit') || // Number keys (Digit1, Digit2, etc.)
                keyCode.startsWith('F') && /^F\d+$/.test(keyCode) || // Function keys (F1, F2, etc.)
                ['Space', 'Enter', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
                 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(keyCode) // Special keys
            )) {
                keys.push(keyCode);
                const newKeybinding = keys.join('+');
                
                display.textContent = formatKeybinding(newKeybinding);
                display.dataset.keybinding = newKeybinding;
                display.className = 'm-keybinding-display success';
                
                recordBtn.textContent = 'Record New Hotkey';
                recordBtn.disabled = false;
                
                document.removeEventListener('keydown', recordingHandler, true);
                
                setTimeout(() => {
                    display.className = 'm-keybinding-display';
                }, 2000);
            } else if (event.key === 'Escape') {
                // Cancel recording
                display.textContent = formatKeybinding(display.dataset.keybinding);
                display.className = 'm-keybinding-display';
                recordBtn.textContent = 'Record New Hotkey';
                recordBtn.disabled = false;
                document.removeEventListener('keydown', recordingHandler, true);
            }
        };
        
        document.addEventListener('keydown', recordingHandler, true);
        
        // Auto-cancel after 10 seconds
        setTimeout(() => {
            if (recordBtn.disabled) {
                display.textContent = formatKeybinding(display.dataset.keybinding);
                display.className = 'm-keybinding-display';
                recordBtn.textContent = 'Record New Hotkey';
                recordBtn.disabled = false;
                document.removeEventListener('keydown', recordingHandler, true);
            }
        }, 10000);
    };

    const diffDetails = (current, previous) => {
        const changes = {}; const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
        for (const key of allKeys) { if (current[key] !== previous[key]) { changes[key] = { from: previous[key] ?? 'N/A', to: current[key] ?? 'N/A' }; } }
        return changes;
    };
    const formatTimeSince = (date1, date2) => {
        let delta = Math.abs(new Date(date1) - new Date(date2)) / 1000; const result = [];
        const timeUnits = { d: 86400, h: 3600, m: 60 };
        Object.entries(timeUnits).forEach(([unit, seconds]) => { if (delta >= seconds) { const value = Math.floor(delta / seconds); delta %= seconds; result.push(`${value}${unit}`); } });
        return result.length ? result.slice(0, 2).join(' ') : `${Math.round(delta)}s`;
    };
    const handleGlobalAction = async (e) => {
        const target = e.target.closest('[data-action], .expandable'); if (!target) return;
        if (target.matches('.expandable')) { target.classList.toggle('expanded'); return; }
        const action = target.dataset.action;
        switch (action) {
            case 'open-logs': toggleDialog(createLogsDialog); break; 
            case 'open-settings': openDialog(createSettingsDialog); break; 
            case 'open-stats': openDialog(createStatsDialog); break;
            case 'close': closeDialog(); break;
            case 'clear-logs': if (confirm("Are you sure you want to permanently delete all logs? This cannot be undone.")) { logs = []; await saveData(LOGS_KEY, []); showToast("Logs Cleared", "System"); closeDialog(); } break;
            case 'export-csv': downloadCSV(convertToCSV(logs), `logs_export_${new Date().toISOString().split('T')[0]}.csv`); showToast("Exporting to CSV...", `${logs.length} records`); break;
            case 'export-stats-csv': 
                const stats = calculateStatistics();
                if (stats) {
                    const statsCSV = convertStatsToCSV(stats);
                    downloadCSV(statsCSV, `order_statistics_${new Date().toISOString().split('T')[0]}.csv`);
                    showToast("Statistics exported", "CSV file");
                }
                break;
            case 'save':
                const form = activeDialog.querySelector('.m-dialog-content');
                settings.theme = form.querySelector('#setting-theme').value; 
                settings.buttonPosition = form.querySelector('#setting-position').value;
                settings.logLimit = parseInt(form.querySelector('#setting-loglimit').value, 10); 
                settings.keybinding = form.querySelector('.m-keybinding-display').dataset.keybinding;
                settings.noLogOnRefresh = form.querySelector('#setting-norefresh').checked; 
                settings.showToast = form.querySelector('#setting-showtoast').checked;
                if (settings.theme === 'custom') { 
                    settings.customTheme = { 
                        bg: form.querySelector('#custom-bg').value, 
                        surface: form.querySelector('#custom-surface').value, 
                        surface_container: form.querySelector('#custom-surface_container').value, 
                        primary: form.querySelector('#custom-primary').value, 
                        text: form.querySelector('#custom-text').value, 
                        subtle: form.querySelector('#custom-subtle').value 
                    }; 
                }
                await saveData(SETTINGS_KEY, settings); 
                applyAppSettings(); 
                closeDialog(); 
                break;
        }
    };
    const applyAppSettings = () => {
        const root = document.documentElement; const themes = {
            'rose-pine-moon': '--bg: #191724; --surface: #232136; --surface-container: #302d41; --primary: #eb6f92; --text: #e0def4; --subtle: #44415a;',
            'rose-pine-dawn': '--bg: #faf4ed; --surface: #fffaf3; --surface-container: #f2e9de; --primary: #d7827e; --text: #575279; --subtle: #dfdad9;',
            'custom': Object.entries(settings.customTheme).map(([k, v]) => `--${k.replace(/_/g, '-')}: ${v}`).join(';')
        };
        root.style.cssText = themes[settings.theme] || themes['rose-pine-moon'];
        if (uiContainer) uiContainer.className = `position-${settings.buttonPosition}`; setupHotkey();
    };
    let hotkeyListener; 
    
    const setupHotkey = () => {
        if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener, true);
        
        hotkeyListener = (event) => {
            if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
            
            const keybinding = settings.keybinding;
            const keys = keybinding.split('+');
            const keyCode = keys.pop(); // This will be a key code like 'KeyL', not a character
            const mods = { 
                ctrl: keys.includes('ctrl'), 
                cmd: keys.includes('cmd'),
                meta: keys.includes('meta'),
                shift: keys.includes('shift'), 
                alt: keys.includes('alt') 
            };
            
            // Handle both ctrl and cmd for cross-platform compatibility
            const hasCtrlOrCmd = event.ctrlKey || event.metaKey;
            const needsCtrlOrCmd = mods.ctrl || mods.cmd || mods.meta;
            
            // Use event.code for layout-independent comparison
            if (event.code === keyCode && 
                (!needsCtrlOrCmd || hasCtrlOrCmd) &&
                event.shiftKey === mods.shift && 
                event.altKey === mods.alt) {
                event.preventDefault();
                event.stopPropagation();
                toggleDialog(createLogsDialog);
            }
        };
        
        document.addEventListener('keydown', hotkeyListener, true);
    };

    // =================================================================================
    // --- 5. STYLES & INITIALIZATION ---
    // =================================================================================
    const injectStyles = () => { GM.addStyle(`
        :root { /* Dynamically set */ }
        .m-logger-toast { position: fixed; top: 20px; right: 20px; background-color: var(--surface-container); color: var(--text); padding: clamp(10px, 1.2vw, 12px) clamp(16px, 1.5vw, 20px); border-radius: 8px; border-left: 4px solid var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: translateX(120%); transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1); z-index: 10001; font-size: clamp(14px, 1.5vw, 16px); }
        .m-logger-toast.visible { transform: translateX(0); } .m-logger-toast span { opacity: 0.7; margin-left: 8px; }
        #m-logger-ui-container { position: fixed; z-index: 9998; display: flex; flex-direction: column; gap: clamp(10px, 1.5vw, 12px); }
        .position-bottom-right { bottom: 20px; right: 20px; } .position-bottom-left { bottom: 20px; left: 20px; } .position-top-right { top: 20px; right: 20px; } .position-top-left { top: 20px; left: 20px; }
        .m-fab { width: 48px; height: 48px; border-radius: 14px; border: none; cursor: pointer; background-color: var(--surface); color: var(--primary); box-shadow: 0 3px 8px rgba(0,0,0,0.2); transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
        .m-fab:hover { box-shadow: 0 5px 12px rgba(0,0,0,0.3); transform: translateY(-2px); } .m-fab svg { width: 22px; height: 22px; fill: currentColor; }
        .m-dialog-container { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
        .m-dialog-container.visible { opacity: 1; pointer-events: auto; } .m-scrim { position: absolute; inset: 0; background-color: var(--bg); opacity: 0.6; }
        .m-dialog { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: var(--surface); color: var(--text); border-radius: clamp(16px, 3vw, 24px); width: min(95vw, 900px); display: flex; flex-direction: column; max-height: 90vh; box-shadow: 0 8px 24px rgba(0,0,0,0.3); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .m-dialog-container.visible .m-dialog { transform: scale(1); }
        .m-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: clamp(16px, 2vw, 20px) clamp(20px, 3vw, 24px) 0; flex-shrink: 0; }
        .m-dialog-title { font-size: clamp(20px, 2.5vw, 22px); font-weight: 500; color: var(--primary); }
        .m-dialog-content { padding: clamp(12px, 2vw, 20px) clamp(20px, 3vw, 24px); overflow-y: auto; flex-grow: 1; }
        .m-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: clamp(8px, 2vw, 16px) clamp(20px, 3vw, 24px); border-top: 1px solid var(--subtle); flex-shrink: 0; }
        .m-icon-button { background: none; border: none; border-radius: 50%; width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; color: var(--text); cursor: pointer; opacity: 0.7; } .m-icon-button:hover { opacity: 1; background: rgba(255,255,255,0.08); }
        .m-text-button { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1px solid var(--subtle); color: var(--text); padding: 0 16px; height: 40px; border-radius: 20px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
        .m-text-button:hover { background-color: var(--surface-container); } .m-text-button.danger { color: #f38ba8; border-color: #f38ba8; } .m-text-button.danger:hover { background-color: #f38ba81a; } .m-text-button svg { width: 18px; height: 18px; fill: currentColor; }
        .m-filled-button { background-color: var(--primary); color: var(--bg, #191724); border: none; padding: 0 24px; height: 40px; border-radius: 20px; font-weight: 500; cursor: pointer; }
        .m-list-subheader { font-size: clamp(14px, 1.8vw, 16px); font-weight: 500; color: var(--primary); padding: 16px 0 8px; border-bottom: 1px solid var(--subtle); }
        .m-list-item-group { border-radius: 12px; background-color: var(--surface-container); margin: 8px 0; overflow: hidden; }
        .m-list-item { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: clamp(12px, 1.5vw, 16px); cursor: pointer; transition: background-color 0.2s; row-gap: 4px; } .m-list-item:hover { background-color: var(--subtle); }
        .m-list-item-content { grid-column: 1; grid-row: 1; min-width: 0; }
        .m-list-item-meta { grid-column: 2; grid-row: 1 / 3; align-self: center; flex-shrink: 0; display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.7; }
        .m-list-item-header { display: flex; justify-content: space-between; align-items: baseline; }
        .m-list-item-footer { display: flex; justify-content: space-between; align-items: baseline; }
        .m-list-item-title a { font-size: clamp(16px, 2vw, 18px); color: var(--text); text-decoration: none; font-weight: 500; } .m-list-item-title a:hover { color: var(--primary); }
        .m-list-item-timestamp { font-size: 12px; color: var(--text); opacity: 0.6; flex-shrink: 0; }
        .m-list-item-subtitle { font-size: clamp(12px, 1.5vw, 14px); color: var(--text); opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .m-list-item-last-visit { font-size: 12px; font-style: italic; color: var(--text); opacity: 0.6; }
        .m-list-item-meta .m-icon-button { transition: transform 0.3s ease; } .m-list-item.expanded .m-list-item-meta .m-icon-button { transform: rotate(180deg); }
        .m-expand-content { max-height: 0; overflow: hidden; transition: max-height 0.4s ease-out; } .m-list-item.expanded + .m-expand-content { max-height: 2000px; transition: max-height 0.6s ease-in; }
        .m-expand-content > ul { padding: 4px clamp(12px, 2vw, 16px) 12px; border-top: 1px solid var(--subtle); } .m-expand-content li { padding: 8px 0; border-bottom: 1px solid var(--subtle); font-size: clamp(13px, 1.5vw, 14px); } .m-expand-content li:last-child { border: none; }
        .visit-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; font-size: 14px; } .visit-header .time { font-weight: 500; } .visit-header .time-diff { font-style: italic; opacity: 0.6; }
        .changes-list, .details-list { list-style: none; padding-left: 16px; margin: 8px 0 4px; }
        .changes-list { border-left: 2px solid var(--primary); color: var(--primary); } .details-list { border-left: 2px solid var(--subtle); }
        .details-list li { display: grid; grid-template-columns: minmax(100px, max-content) 1fr; gap: 8px; } .details-list strong { color: var(--text); opacity: 0.7; } .details-list span { word-break: break-word; }
        .m-setting-row { display: grid; grid-template-columns: 1fr 2fr; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--subtle); } .m-setting-row.checkbox { display: flex; justify-content: flex-start; gap: 8px; } .m-setting-row label { opacity: 0.8; } .m-setting-row input, .m-setting-row select { background: var(--bg); color: var(--text); border: 1px solid var(--subtle); border-radius: 8px; padding: 8px; }
        .m-keybinding-container { display: flex; align-items: center; gap: 12px; }
        .m-keybinding-display { background: var(--surface-container); border: 1px solid var(--subtle); border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 14px; min-width: 120px; text-align: center; transition: all 0.2s; }
        .m-keybinding-display.recording { background: var(--primary); color: var(--bg); border-color: var(--primary); animation: pulse 1.5s infinite; }
        .m-keybinding-display.success { background: var(--primary); color: var(--bg); border-color: var(--primary); }
        .m-keybinding-record { background: var(--surface); border: 1px solid var(--subtle); color: var(--text); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        .m-keybinding-record:hover { background: var(--surface-container); }
        .m-keybinding-record:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        #custom-theme-settings { display: none; grid-template-columns: 1fr 2fr; gap: 10px; align-items: center; background: var(--bg); padding: 15px; border-radius: 6px; margin: 10px 0; } #custom-theme-settings input[type="color"] { width: 100%; height: 30px; border: none; background: none; }
        
        /* Statistics Styles */
        .m-stats-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .m-stat-card { background: var(--surface-container); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--subtle); }
        .m-stat-value { font-size: 28px; font-weight: 600; color: var(--primary); margin-bottom: 4px; }
        .m-stat-label { font-size: 12px; color: var(--text); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .m-stats-section { margin-bottom: 32px; }
        .m-stats-section h3 { color: var(--primary); font-size: 16px; font-weight: 500; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--subtle); }
        
        .m-chart { display: flex; align-items: end; justify-content: space-between; gap: 8px; height: 120px; padding: 16px; background: var(--surface-container); border-radius: 8px; margin-bottom: 8px; }
        .m-chart-bar { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 60px; }
        .m-bar { background: linear-gradient(180deg, var(--primary) 0%, var(--primary)80 100%); border-radius: 4px 4px 0 0; width: 100%; min-height: 4px; margin-bottom: 8px; transition: all 0.3s ease; }
        .m-chart-bar:hover .m-bar { filter: brightness(1.2); }
        .m-bar-label { font-size: 11px; color: var(--text); opacity: 0.7; margin-bottom: 4px; text-align: center; }
        .m-bar-value { font-size: 10px; color: var(--text); opacity: 0.6; text-align: center; line-height: 1.2; }
        
        .m-top-list { background: var(--surface-container); border-radius: 8px; overflow: hidden; }
        .m-top-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--subtle); }
        .m-top-item:last-child { border-bottom: none; }
        .m-top-name { color: var(--text); font-size: 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .m-top-count { color: var(--primary); font-size: 12px; font-weight: 500; flex-shrink: 0; margin-left: 12px; }
        
        /* Responsive adjustments */
        @media (max-width: 600px) { 
            .m-dialog-actions { justify-content: center; } 
            .details-list li { grid-template-columns: 1fr; }
            .m-stats-overview { grid-template-columns: repeat(2, 1fr); }
            .m-chart { height: 100px; }
        }
    `); };
    const waitForElement = (selector, timeout = 0) => new Promise((resolve) => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));
        const observer = new MutationObserver(() => { if (document.querySelector(selector)) { resolve(document.querySelector(selector)); observer.disconnect(); } });
        observer.observe(document.body, { childList: true, subtree: true });
        if (timeout) setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });

    // --- Script Initialization ---
    if (window.top !== window.self) return;
    await loadData();
    injectStyles();
    document.addEventListener('DOMContentLoaded', () => {
        uiContainer = document.createElement('div');
        uiContainer.id = 'm-logger-ui-container';
        uiContainer.innerHTML = `<button class="m-fab" data-action="open-settings" title="Settings">${ICONS.settings}</button><button class="m-fab" data-action="open-stats" title="Statistics">${ICONS.stats}</button><button class="m-fab" data-action="open-logs" title="View Logs">${ICONS.logs}</button>`;
        document.body.appendChild(uiContainer);
        applyAppSettings();
        document.body.addEventListener('click', handleGlobalAction);
        GM_registerMenuCommand("Logger Settings", () => openDialog(createSettingsDialog));
        GM_registerMenuCommand("View Statistics", () => openDialog(createStatsDialog));
        logOrderVisit();
    });
})();