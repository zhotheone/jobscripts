// ==UserScript==
// @name         Shift Dashboard
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.1
// @description  A better way to handle schedule. Fetches current and next month's data.
// @author       Heorhii Litovskyi (George)
// @match        https://essaycock.com/support/dashboard/*
// @resource     FIRA_CODE_CSS https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/shift-dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/shift-dashboard.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const SHIFT_API_URL = 'https://api.speedy.company/dashboard/shifts';
    const NBU_API_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json';
    const CACHE_KEY = 'filteredShiftsData_v3';
    const SETTINGS_KEY = 'scsd_settings_v6';
    // ---
    let statusUpdateInterval = null;
    let dataHasBeenIntercepted = false;
    let isMac = navigator.userAgent.includes('Mac');
    let displayedMonthState = { year: null, month: null };

    // --- DEFAULT SETTINGS ---
    const defaultSettings = {
        hourlyRateUSD: 0, nightRateMultiplier: 1.0, ocRateMultiplier: 1.0,
        asRateMultiplier: 1.0, supRateMultiplier: 1.0, highlightSupport: true,
        dashboardHotkey: 'KeyK', calendarHotkey: 'KeyJ',
        colorSettings: {},
        usdToUahRate: { rate: 0, timestamp: 0 }
    };

    // --- STYLES ---
    const firaCodeCss = GM_getResourceText("FIRA_CODE_CSS");
    GM_addStyle(firaCodeCss);
    GM_addStyle(`
        :root {
            --base: #232136; --surface: #2a273f; --overlay: #393552; --muted: #6e6a86;
            --subtle: #908caa; --text: #e0def4; --love: #eb6f92; --gold: #f6c177; --rose: #ea9a97;
            --pine: #3e8fb0; --foam: #9ccfd8; --iris: #c4a7e7; --highlight-low: #2a283e;
            --highlight-med: #44415a; --highlight-high: #56526e; --border-color: var(--highlight-med);
            --font-main: 'Fira Code', 'Inter', monospace;
        }
        #scsd-navbar-injection { padding: 15px 10px; display: flex; align-items: center; gap: 15px; font-family: var(--font-main) !important; }
        #scsd-navbar-injection span { font-size: 14px !important; font-family: var(--font-main) !important; color: var(--subtle) !important; }
        #scsd-navbar-injection .nav-status-text b { color: var(--foam) !important; }
        #scsd-navbar-injection .nav-status-text .time-highlight { color: var(--rose) !important; font-weight: 700; }
        #scsd-navbar-injection .nav-salary-text b { color: var(--gold) !important; }
        #scsd-navbar-injection .nav-cem-text, #scsd-navbar-injection .nav-hotkey-text { opacity: 0.8; }
        #scsd-navbar-injection .nav-hotkey-text b { color: var(--muted); font-weight: 700; }
        #scsd-navbar-injection .separator { border-left: 1px solid #4f749d; height: 20px; opacity: 0.5; }
        #shift-helper-panel { position: fixed; bottom: 15px; right: 15px; background-color: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; z-index: 9999; box-shadow: 0 8px 25px rgba(0,0,0,0.3); font-family: var(--font-main); width: 320px; color: var(--text); display: none; flex-direction: column; gap: 12px; }
        #shp-header { display: flex; justify-content: space-between; align-items: center; }
        #shp-header h3 { margin: 0; font-size: 16px; color: var(--text); font-weight: 700; }
        .shp-header-actions { display: flex; align-items: center; gap: 8px; }
        #shp-settings-btn { background: none; border: none; color: var(--subtle); cursor: pointer; font-size: 18px; padding: 4px; transition: color 0.2s; }
        #shp-settings-btn:hover { color: var(--text); }
        #shp-status-light { width: 10px; height: 10px; border-radius: 50%; background-color: var(--muted); transition: background-color 0.3s; }
        #shp-info { font-size: 11px; color: var(--subtle); line-height: 1.4; min-height: 28px; background: var(--base); padding: 5px 8px; border-radius: 6px; }
        #shp-actions { display: flex; gap: 8px; }
        #shift-helper-panel button { padding: 8px 12px; background-color: var(--highlight-med); color: var(--text); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; font-weight: 500; }
        #shift-helper-panel button:not(:disabled):hover { background-color: var(--highlight-high); border-color: var(--subtle); }
        #shift-helper-panel button:disabled { background-color: var(--overlay); color: var(--muted); cursor: not-allowed; border-color: var(--overlay); }
        #shp-actions #show-schedule-btn { flex-grow: 1; background-color: var(--iris); border-color: var(--iris); color: var(--base); }
        #shp-actions #export-calendar-btn { background-color: var(--pine); border-color: var(--pine); color: var(--base); }
        #shp-settings { display: none; flex-direction: column; gap: 12px; margin-top: 5px; background: var(--base); padding: 12px; border-radius: 6px; }
        .setting-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .setting-item label { font-size: 13px; color: var(--subtle); flex-shrink: 0; }
        .setting-item input[type="number"], .setting-item input[type="text"] { width: 80px; background: var(--highlight-low); border: 1px solid var(--border-color); color: var(--text); border-radius: 4px; padding: 5px; text-align: right; font-family: var(--font-main); }
        .setting-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--iris); }
        #support-status-panel { margin-top: 5px; padding-top: 15px; border-top: 1px solid var(--border-color); display: none; }
        #support-selector { width: 100%; background-color: var(--highlight-low); color: var(--text); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-family: var(--font-main); margin-bottom: 10px; }
        #color-settings-panel { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--highlight-med); }
        #color-settings-panel h4 { margin: 0 0 10px; font-size: 13px; color: var(--foam); text-align: center; }
        #color-pickers { display: flex; justify-content: space-around; }
        .color-picker-item input[type="color"] { width: 40px; height: 25px; border: none; padding: 0; background: none; }
        .color-picker-item label { font-size: 11px; display: block; text-align: center; margin-bottom: 5px; }
        #live-status-label { font-size: 12px; line-height: 1.5; background-color: var(--base); padding: 10px; border-radius: 6px; min-height: 50px; }
        #live-status-label b { color: var(--foam); } #live-status-label .time-highlight { font-weight: bold; color: var(--rose); }
        #salary-info { display: none; margin-top: 10px; font-size: 12px; line-height: 1.6; background-color: var(--base); padding: 10px; border-radius: 6px; }
        #salary-info b { color: var(--gold); }
        #salary-info .night-hours { color: var(--iris); }
        .sh-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(19, 17, 28, 0.85); backdrop-filter: blur(5px); z-index: 10000; display: none; justify-content: center; align-items: center; font-family: var(--font-main); }
        .sh-modal-content { background: var(--base); color: var(--text); padding: 25px; border-radius: 12px; width: 95vw; max-width: 1800px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid var(--border-color); }
        .sh-modal-header { display: flex; align-items: center; margin-bottom: 15px; }
        .sh-modal-header h2 { flex-grow: 1; text-align: center; margin: 0 10px; color: var(--foam); font-size: 20px; }
        .sh-modal-close { font-size: 28px; font-weight: bold; color: var(--muted); cursor: pointer; transition: color 0.2s; line-height: 1; }
        .sh-modal-close:hover { color: var(--text); }
        .sh-modal-nav { background: none; border: 1px solid var(--muted); color: var(--muted); border-radius: 6px; padding: 4px 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .sh-modal-nav:hover:not(:disabled) { background-color: var(--highlight-high); color: var(--text); border-color: var(--text); }
        .sh-modal-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .scsd-dialog-modal { background: var(--surface); border: 1px solid var(--border-color); padding: 20px 25px; border-radius: 12px; width: 90vw; max-width: 450px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
        .scsd-dialog-modal h3 { margin: 0 0 15px; color: var(--foam); font-size: 18px; text-align: center; }
        .scsd-dialog-modal p { margin: 0 0 20px; color: var(--subtle); font-size: 14px; line-height: 1.6; }
        .scsd-dialog-modal .dialog-actions { display: flex; flex-direction: column; gap: 10px; }
        .scsd-dialog-modal button { width: 100%; padding: 10px; font-size: 14px; font-weight: 700; }
        .scsd-dialog-modal button.primary { background-color: var(--iris); color: var(--base); border-color: var(--iris); }
        .scsd-dialog-modal button.secondary { background-color: var(--highlight-med); }
        .scsd-dialog-modal button.cancel { background-color: transparent; border: 1px solid var(--muted); color: var(--muted); margin-top: 5px; }
        .scsd-dialog-modal ol { padding-left: 20px; margin: 0 0 20px; }
        .scsd-dialog-modal li { margin-bottom: 10px; color: var(--subtle); } /* FIXED: Correct list item color */
        .scsd-dialog-modal code { background-color: var(--base); padding: 2px 6px; border-radius: 4px; color: var(--gold); font-family: var(--font-main); }
        #sh-schedule-container { flex-grow: 1; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: var(--highlight-high) var(--base); }
        .sh-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: auto; gap: 2px; min-height: 100%; }
        .sh-day-cell { background-color: var(--surface); border-radius: 4px; display: flex; flex-direction: column; overflow: hidden; position: relative; min-height: 140px; }
        .day-shifts-wrapper { scroll-behavior: smooth; }
        .person-avatar { padding: 2px 8px; border-radius: 10px; border: 1px solid var(--base); font-size: 11px; display: inline-flex; justify-content: center; align-items: center; font-weight: 500; transition: box-shadow 0.2s; }
        .person-avatar.highlighted { box-shadow: 0 0 0 2px var(--iris); }
        .calendar-weekday-header { color: var(--subtle); font-weight: 700; text-align: center; padding: 10px 0; font-size: 14px; }
        .sh-day-cell.empty { background-color: var(--highlight-low); min-height: 0; }
        .sh-day-cell.today { border: 2px solid var(--gold); }
        .day-cell-header { padding: 8px; flex-shrink: 0; }
        .sh-day-number { font-size: 13px; font-weight: bold; color: var(--subtle); }
        .sh-day-cell.today .sh-day-number { color: var(--gold); }
        .day-cem-name { color: var(--gold); font-weight: 400; font-size: 11px; opacity: 0.8; }
        .day-shifts-wrapper { flex-grow: 1; overflow-y: auto; min-height: 0; padding: 0 8px 8px 8px; display: flex; flex-direction: column; gap: 6px; scrollbar-width: thin; scrollbar-color: var(--highlight-high) transparent; }
        .day-shifts-wrapper::-webkit-scrollbar { width: 8px; } .day-shifts-wrapper::-webkit-scrollbar-track { background: transparent; } .day-shifts-wrapper::-webkit-scrollbar-thumb { background-color: var(--highlight-high); border-radius: 4px; border: 2px solid var(--surface); }
        .calendar-shift-card { background: var(--highlight-low); padding: 5px; border-radius: 4px; border-left: 3px solid var(--iris); }
        .shift-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
        .shift-card-time { font-size: 11px; font-weight: 700; color: var(--text); }
        .shift-card-type { font-size: 11px; color: var(--subtle); }
        .person-avatar-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .person-avatar .count { font-size: 10px; opacity: 0.8; padding-left: 4px; }
        @media (max-width: 1200px) { .sh-calendar-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 800px) { .sh-calendar-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 600px) { .sh-calendar-grid { grid-template-columns: 1fr; } .calendar-weekday-header { display: none; } }
    `);

    // --- HELPER & SETTINGS FUNCTIONS ---
    function getSettings() { return { ...defaultSettings, ...GM_getValue(SETTINGS_KEY, {}) }; }
    function saveSettings(settings) { GM_setValue(SETTINGS_KEY, settings); }
    function getRoleMultiplier(shiftTitle, settings) { if (shiftTitle.includes('(OC)')) return settings.ocRateMultiplier; if (shiftTitle.includes('(AS)')) return settings.asRateMultiplier; if (shiftTitle.includes('(Sup')) return settings.supRateMultiplier; return 1.0; }
    function renderShiftAvatar(shift, count = 1, isHighlighted = false) { const fullName = shift.title || 'Unassigned'; const supporterName = fullName.replace(/\s\(.*\)/, ''); const firstName = supporterName.split(' ')[0]; let position = ''; const positionMatch = fullName.match(/\((.+?)\)/); if (positionMatch) { position = positionMatch[1].trim(); } const settings = getSettings(); const customColors = settings.colorSettings[supporterName]; const bgColor = customColors?.bg || shift.color || '#908caa'; const textColor = customColors?.text || '#232136'; const positionDisplay = position ? ` (${position})` : ''; const countDisplay = count > 1 ? `<span class="count">(x${count})</span>` : ''; const avatarText = `${firstName}${positionDisplay}${countDisplay}`; const fullTitle = `${supporterName}${positionDisplay}${count > 1 ? ` (x${count})` : ''}`; const highlightClass = isHighlighted ? 'highlighted' : ''; return `<div class="person-avatar ${highlightClass}" style="background-color:${bgColor}; color:${textColor};" title="${fullTitle}">${avatarText}</div>`; }
    const getShiftType = (startTime) => { const hour = parseInt(startTime.toLocaleTimeString('en-GB', { hour: '2-digit', timeZone: 'Europe/Kyiv', hour12: false })) || 0; if (hour >= 7 && hour < 15) return "☀️"; if (hour >= 15 && hour < 19) return "🌙"; if (hour >= 19 || hour < 7) return "🌃"; return "🕒"; };
    function formatDuration(ms) { if (ms < 0) ms = 0; const totalSeconds = Math.floor(ms / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; if (days > 0) return `${days}d ${hours}h ${minutes}m`; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }

    // --- SALARY & DATA FUNCTIONS ---
    async function fetchAndCacheExchangeRate() { const settings = getSettings(); const sixHours = 6 * 60 * 60 * 1000; if (Date.now() - settings.usdToUahRate.timestamp < sixHours && settings.usdToUahRate.rate > 0) { return settings.usdToUahRate.rate; } try { const response = await fetch(NBU_API_URL); const data = await response.json(); if (data && data[0] && data[0].rate) { const newRate = data[0].rate; settings.usdToUahRate = { rate: newRate, timestamp: Date.now() }; saveSettings(settings); return newRate; } } catch (error) { console.error('Failed to fetch exchange rate:', error); } return settings.usdToUahRate.rate; }
    function calculateNightHours(start, end) { let nightHours = 0; const nightStartHour = 22; const nightEndHour = 6; let current = new Date(start); while (current < end) { const hour = current.getHours(); if (hour >= nightStartHour || hour < nightEndHour) { nightHours += 1/60; } current.setMinutes(current.getMinutes() + 1); } return nightHours; }
    async function getSupporterInfo(supporterName) { const settings = getSettings(); const cache = GM_getValue(CACHE_KEY); const modifier = isMac ? 'Cmd' : 'Ctrl'; const dashKey = settings.dashboardHotkey.replace(/^(Key|Digit)/, ''); const calKey = settings.calendarHotkey.replace(/^(Key|Digit)/, ''); const hotkeyHtml = `Dashboard: <b>${modifier}+${dashKey}</b> | Calendar: <b>${modifier}+${calKey}</b>`; if (!cache?.shifts) { return { statusHtml: '', salaryHtml: '', cemHtml: '', hotkeyHtml, personShifts: [], settings }; } const todayKey = new Date().toISOString().split('T')[0]; const todayShifts = cache.shifts.filter(s => s.starts_at && s.starts_at.startsWith(todayKey)); const cemNames = [...new Set(todayShifts.filter(s => s.title?.includes('(CEM')).map(s => (s.title.match(/(.+?)\s+\(/) || [])[1]?.trim()))].filter(Boolean); const cemHtml = cemNames.length > 0 ? `CEM: ${cemNames.join(', ')}` : ''; if (!supporterName) { return { statusHtml: '', salaryHtml: '', cemHtml, hotkeyHtml, personShifts: [], settings }; } const personShifts = cache.shifts.filter(s => s.title?.startsWith(supporterName + ' (')).sort((a, b) => new Date(a.starts_at + 'Z') - new Date(b.starts_at + 'Z')); const now = new Date(); let currentShift = null, nextShift = null; for (const shift of personShifts) { const start = new Date(shift.starts_at + 'Z'); const end = new Date(shift.ends_at + 'Z'); if (now >= start && now <= end) { currentShift = { ...shift, start, end }; } else if (now < start && !nextShift) { nextShift = { ...shift, start, end }; } } let statusHtml = ''; if (currentShift) { const position = (currentShift.title.match(/\((.*?)\)/) || [])[1] || ''; statusHtml = `<b>${supporterName}</b> (${position}) is <span class="time-highlight">ON SHIFT</span>. Ends in: ${formatDuration(currentShift.end - now)}.`; } else if (nextShift) { statusHtml = `<b>${supporterName}</b> is off shift. Next in: <span class="time-highlight">${formatDuration(nextShift.start - now)}</span>.`; } else { statusHtml = `<b>${supporterName}</b> has no more upcoming shifts.`; } let salaryHtml = ''; let totalHours = 0; let totalNightHours = 0; if (settings.hourlyRateUSD > 0) { let totalSalaryUSD = 0; personShifts.forEach(shift => { const start = new Date(shift.starts_at + 'Z'); const end = new Date(shift.ends_at + 'Z'); const roleMultiplier = getRoleMultiplier(shift.title, settings); const nightHoursInShift = calculateNightHours(start, end); const dayHoursInShift = ((end - start) / 3600000) - nightHoursInShift; totalNightHours += nightHoursInShift; totalHours += dayHoursInShift + nightHoursInShift; const dayPay = dayHoursInShift * settings.hourlyRateUSD * roleMultiplier; const nightPay = nightHoursInShift * settings.hourlyRateUSD * roleMultiplier * settings.nightRateMultiplier; totalSalaryUSD += dayPay + nightPay; }); const exchangeRate = await fetchAndCacheExchangeRate(); const totalSalaryUAH = totalSalaryUSD * exchangeRate; salaryHtml = `Total: <b>$${totalSalaryUSD.toFixed(2)}</b> (~${totalSalaryUAH.toLocaleString('uk-UA', {style:'currency', currency:'UAH'})})`; } return { statusHtml, salaryHtml, cemHtml, hotkeyHtml, personShifts, settings, totalHours, totalNightHours }; }
    async function updateInfoPanels() { const supporterName = document.getElementById('support-selector')?.value || GM_getValue('selectedSupporterName', ''); const { statusHtml, salaryHtml, cemHtml, hotkeyHtml, personShifts, settings, totalHours, totalNightHours } = await getSupporterInfo(supporterName); const liveStatusLabel = document.getElementById('live-status-label'); if (liveStatusLabel) { liveStatusLabel.innerHTML = statusHtml || 'Select a supporter to see their live status.'; } const salaryInfoDiv = document.getElementById('salary-info'); if (salaryInfoDiv) { if (salaryHtml && personShifts.length > 0) { salaryInfoDiv.innerHTML = `Total for <b>${supporterName}</b> (Current & Next Month):<br>Total Hours: <b>${totalHours.toFixed(2)}</b><br>Regular Hours: ${(totalHours - totalNightHours).toFixed(2)}<br><span class="night-hours">Night Hours: ${totalNightHours.toFixed(2)} (x${settings.nightRateMultiplier})</span><br><small>(Role rates applied as per settings)</small><br>${salaryHtml.replace('Total:', 'Salary:')}`; salaryInfoDiv.style.display = 'block'; } else { salaryInfoDiv.style.display = 'none'; } } const navInjection = document.getElementById('scsd-navbar-injection'); if (navInjection) { let finalNavHtml = `<span class="nav-hotkey-text">${hotkeyHtml}</span>`; if (statusHtml) { finalNavHtml += `<span class="separator"></span><span class="nav-status-text">${statusHtml}</span>`; } if (salaryHtml) { finalNavHtml += `<span class="separator"></span><span class="nav-salary-text">${salaryHtml}</span>`; } if (cemHtml) { finalNavHtml += `<span class="separator"></span><span class="nav-cem-text">${cemHtml}</span>`; } navInjection.innerHTML = finalNavHtml; } }

    // --- CALENDAR EXPORT FUNCTIONS ---
    function formatICSDate(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    function generateICS(events) { const cal = [ 'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SpeedyShiftDashboard//EN' ]; events.forEach(event => { const start = new Date(event.start + 'Z'); const end = new Date(event.end + 'Z'); cal.push( 'BEGIN:VEVENT', `UID:${event.id}@speedy.company.script`, `DTSTAMP:${formatICSDate(new Date())}`, `DTSTART:${formatICSDate(start)}`, `DTEND:${formatICSDate(end)}`, `SUMMARY:${event.summary.replace(/,/g, '\\,')}`, 'LOCATION:Remote', `DESCRIPTION:${event.description.replace(/,/g, '\\,').replace(/\n/g, '\\n')}`, 'END:VEVENT' ); }); cal.push('END:VCALENDAR'); return cal.join('\r\n'); }
    function downloadFile(filename, content) { const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    function initiateExportProcess() { const selectedSupporter = document.getElementById('support-selector').value; const modal = document.getElementById('scsd-export-options-modal'); modal.querySelector('#export-contextual-btn').disabled = !selectedSupporter; modal.querySelector('#export-mine-btn').disabled = !selectedSupporter; modal.style.display = 'flex'; }
    function handleCalendarExport(mode) {
        document.getElementById('scsd-export-options-modal').style.display = 'none';
        const cache = GM_getValue(CACHE_KEY);
        if (!cache || !cache.shifts || cache.shifts.length === 0) { alert('No shift data available to export.'); return; }
        const allShifts = cache.shifts;
        const selectedSupporterName = document.getElementById('support-selector').value;
        let eventsToExport = [];
        let fileName = 'all_shifts.ics';
        const nameMatcher = selectedSupporterName + ' (';

        switch(mode) {
            case 'mine': {
                fileName = `${selectedSupporterName.toLowerCase().replace(/ /g, '_')}_shifts.ics`;
                const myShifts = allShifts.filter(s => s.title.startsWith(nameMatcher));
                eventsToExport = myShifts.map(shift => ({
                    id: shift.id,
                    start: shift.starts_at,
                    end: shift.ends_at,
                    summary: shift.title,
                    description: `Your work shift. Type: ${getShiftType(new Date(shift.starts_at + 'Z'))}`
                }));
                break;
            }
            case 'contextual': {
                fileName = `${selectedSupporterName.toLowerCase().replace(/ /g, '_')}_team_shifts.ics`;
                const myShiftTimeSlots = new Set(
                    allShifts
                        .filter(s => s.title.startsWith(nameMatcher))
                        .map(s => `${s.starts_at}|${s.ends_at}`)
                );
                const shiftsByTime = allShifts.reduce((acc, shift) => {
                    const key = `${shift.starts_at}|${shift.ends_at}`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(shift);
                    return acc;
                }, {});

                let shiftsForMySlots = [];
                myShiftTimeSlots.forEach(slotKey => {
                    if (shiftsByTime[slotKey]) {
                        shiftsForMySlots.push(...shiftsByTime[slotKey]);
                    }
                });

                eventsToExport = shiftsForMySlots.map(shift => ({
                    id: shift.id,
                    start: shift.starts_at,
                    end: shift.ends_at,
                    summary: shift.title,
                    description: `Work Shift. Type: ${getShiftType(new Date(shift.starts_at + 'Z'))}`
                }));
                break;
            }
            case 'all': {
                const shiftsByTime = allShifts.reduce((acc, shift) => { const key = `${shift.starts_at}|${shift.ends_at}`; if (!acc[key]) acc[key] = []; acc[key].push(shift); return acc; }, {});
                eventsToExport = Object.values(shiftsByTime).flatMap(group =>
                    group.map(shift => ({
                        id: shift.id,
                        start: shift.starts_at,
                        end: shift.ends_at,
                        summary: shift.title,
                        description: `Work Shift. Type: ${getShiftType(new Date(shift.starts_at + 'Z'))}`
                    }))
                );
                break;
            }
        }
        if (eventsToExport.length === 0) { alert('No shifts found for the selected export type.'); return; }
        const icsContent = generateICS(eventsToExport);
        downloadFile(fileName, icsContent);
        document.getElementById('scsd-import-instructions-modal').style.display = 'flex';
    }

    // --- BUILD & RENDER FUNCTIONS ---
    function buildScheduleView(year, month) {
        displayedMonthState = { year, month };
        const container = document.getElementById('sh-schedule-container');
        const titleEl = document.getElementById('sh-calendar-title');
        const cache = GM_getValue(CACHE_KEY);
        if (!cache?.shifts?.length) { container.innerHTML = '<p>No shift data in cache.</p>'; return; }
        const settings = getSettings();
        const selectedSupporter = document.getElementById('support-selector').value;
        const shiftsByDay = cache.shifts.reduce((acc, shift) => { if (!shift.starts_at) return acc; const dayKey = new Date(shift.starts_at + 'Z').toISOString().split('T')[0]; if (!acc[dayKey]) acc[dayKey] = []; acc[dayKey].push(shift); return acc; }, {});
        const now = new Date();
        if(titleEl) titleEl.textContent = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
        let cells = [];
        cells.push(...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `<div class="calendar-weekday-header">${day}</div>`));
        for (let i = 0; i < startingDayOfWeek; i++) { cells.push('<div class="sh-day-cell empty"></div>'); }
        for (let d = 1; d <= daysInMonth; d++) {
            const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayShifts = shiftsByDay[dayKey] || [];
            const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const cemNames = [...new Set(dayShifts.filter(s => s.title?.includes('(CEM')).map(s => (s.title.match(/(.+?)\s+\(/) || [])[1]?.trim()))].filter(Boolean);
            const cemDisplay = cemNames.length > 0 ? ` <span class="day-cem-name">(CEM: ${cemNames.join(', ')})</span>` : '';
            let dayHtml = `<div class="sh-day-cell ${isToday ? 'today' : ''}" id="day-cell-${d}"><div class="day-cell-header"><div class="sh-day-number">${d}${cemDisplay}</div></div><div class="day-shifts-wrapper">`;
            if (dayShifts.length > 0) {
                const shiftsByTimeRange = dayShifts.reduce((acc, shift) => { const key = shift.starts_at + '|' + shift.ends_at; if (!acc[key]) acc[key] = []; acc[key].push(shift); return acc; }, {});
                const sortedGroups = Object.values(shiftsByTimeRange).sort((a, b) => new Date(a[0].starts_at + 'Z') - new Date(b[0].starts_at + 'Z'));
                for (const group of sortedGroups) {
                    const firstShift = group[0];
                    const start = new Date(firstShift.starts_at + 'Z');
                    const supervisors = [];
                    const startTime = start.toLocaleTimeString('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false });
                    const personCounts = new Map();
                    for (const shift of group) { const personName = (shift.title || 'Unassigned').replace(/\s\(.*\)/, ''); if (personCounts.has(personName)) { personCounts.get(personName).count++; } else { personCounts.set(personName, { count: 1, shiftData: shift }); } }
                    let avatarsHtml = '';
                    for (const { count, shiftData } of personCounts.values()) { const personName = (shiftData.title || 'Unassigned').replace(/\s\(.*\)/, ''); const isHighlighted = settings.highlightSupport && selectedSupporter === personName; avatarsHtml += renderShiftAvatar(shiftData, count, isHighlighted); }
                    dayHtml += `<div class="calendar-shift-card"><div class="shift-card-header"><div class="shift-card-time">${startTime}</div><div class="shift-card-type">${getShiftType(start)}</div></div><div class="person-avatar-list">${avatarsHtml}</div></div>`;
                }
            }
            dayHtml += `</div></div>`;
            cells.push(dayHtml);
        }
        container.innerHTML = `<div class="sh-calendar-grid">${cells.join('')}</div>`;
        if (month === now.getMonth() && year === now.getFullYear()) {
            const todayCell = document.getElementById(`day-cell-${now.getDate()}`);
            if(todayCell) todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Navigation button logic
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const nextMonth = (currentMonth + 1) % 12;
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

        document.getElementById('scsd-prev-month').disabled = (year === currentYear && month === currentMonth);
        document.getElementById('scsd-next-month').disabled = (year === nextMonthYear && month === nextMonth);
    }
    function createUI() {
        if (document.getElementById('shift-helper-panel')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="shift-helper-panel"><div id="shp-header"><h3>Shift Dashboard</h3><div class="shp-header-actions"><button id="shp-settings-btn" title="Settings">⚙️</button><span id="shp-status-light" title="Status"></span></div></div><div id="shp-info">Initializing...</div><div id="shp-settings"><div class="setting-item"><label for="hourly-rate-input">Hourly Rate ($)</label><input type="number" id="hourly-rate-input" step="0.1" min="0"></div><div class="setting-item"><label for="night-rate-input">Night Rate (x)</label><input type="number" id="night-rate-input" step="0.1" min="1"></div><div class="setting-item"><label for="oc-rate-input">OC Rate (x)</label><input type="number" id="oc-rate-input" step="0.1" min="1"></div><div class="setting-item"><label for="as-rate-input">AS Rate (x)</label><input type="number" id="as-rate-input" step="0.1" min="1"></div><div class="setting-item"><label for="sup-rate-input">Sup Rate (x)</label><input type="number" id="sup-rate-input" step="0.1" min="1"></div><div class="setting-item"><label for="dash-hotkey-input">Dashboard Hotkey</label><input type="text" id="dash-hotkey-input"></div><div class="setting-item"><label for="cal-hotkey-input">Calendar Hotkey</label><input type="text" id="cal-hotkey-input"></div><div class="setting-item"><label for="highlight-support-checkbox">Highlight support</label><input type="checkbox" id="highlight-support-checkbox"></div></div><div id="shp-actions"><button id="show-schedule-btn" disabled>View Calendar</button><button id="export-calendar-btn" title="Export shifts to a calendar file" disabled>Export</button><button id="delete-cache-btn" title="Delete shift data">🗑️</button></div><div id="support-status-panel"><select id="support-selector"></select><div id="color-settings-panel"><h4>Customize Colors</h4><div id="color-pickers"><div class="color-picker-item"><label for="bg-color-picker">BG</label><input type="color" id="bg-color-picker"></div><div class="color-picker-item"><label for="text-color-picker">Text</label><input type="color" id="text-color-picker"></div></div></div><div id="live-status-label"></div><div id="salary-info"></div></div></div>
            <div class="sh-modal-overlay" id="sh-calendar-modal"><div class="sh-modal-content"><div class="sh-modal-header"><button id="scsd-prev-month" class="sh-modal-nav" title="Previous Month">◄</button><h2 id="sh-calendar-title"></h2><button id="scsd-next-month" class="sh-modal-nav" title="Next Month">►</button><span class="sh-modal-close">×</span></div><div id="sh-schedule-container"></div></div></div>
            <div class="sh-modal-overlay" id="scsd-export-options-modal"><div class="scsd-dialog-modal"><h3>Export Calendar Options</h3><p>Choose which shifts to export. Personal options require a supporter to be selected from the main panel.</p><div class="dialog-actions"><button id="export-contextual-btn" class="primary">My Team's Shifts</button><button id="export-mine-btn" class="secondary">My Shifts Only</button><button id="export-all-btn" class="secondary">All Company Shifts</button><button id="export-cancel-btn" class="cancel">Cancel</button></div></div></div>
            <div class="sh-modal-overlay" id="scsd-import-instructions-modal"><div class="scsd-dialog-modal"><h3>Export Successful!</h3><p>Your calendar file (<code>.ics</code>) has been downloaded. To add it to Google Calendar:</p><ol><li>Open Google Calendar in your browser.</li><li>Click the <strong>Settings gear ⚙️</strong> icon, then <strong>Settings</strong>.</li><li>In the left menu, click <strong>Import & Export</strong>.</li><li>Under "Import", click <strong>Select file from your computer</strong> and choose the downloaded <code>.ics</code> file.</li><li>Select the calendar you want to add the shifts to, then click <strong>Import</strong>.</li></ol><div class="dialog-actions"><button id="instructions-ok-btn" class="primary">OK</button></div></div></div>
        `);
        const settings = getSettings();
        const rateInput = document.getElementById('hourly-rate-input'); const nightRateInput = document.getElementById('night-rate-input'); const ocRateInput = document.getElementById('oc-rate-input'); const asRateInput = document.getElementById('as-rate-input'); const supRateInput = document.getElementById('sup-rate-input'); const highlightCheck = document.getElementById('highlight-support-checkbox'); const dashHotkeyInput = document.getElementById('dash-hotkey-input'); const calHotkeyInput = document.getElementById('cal-hotkey-input');
        rateInput.value = settings.hourlyRateUSD; nightRateInput.value = settings.nightRateMultiplier; ocRateInput.value = settings.ocRateMultiplier; asRateInput.value = settings.asRateMultiplier; supRateInput.value = settings.supRateMultiplier; highlightCheck.checked = settings.highlightSupport;
        const setupHotkeyInput = (input, settingKey) => { input.value = settings[settingKey].replace(/^(Key|Digit)/, ''); input.addEventListener('click', () => { input.value = '...'; }); input.addEventListener('keydown', (e) => { e.preventDefault(); const currentSettings = getSettings(); currentSettings[settingKey] = e.code; saveSettings(currentSettings); input.value = e.code.replace(/^(Key|Digit)/, ''); input.blur(); updateInfoPanels();}); input.addEventListener('blur', () => { input.value = getSettings()[settingKey].replace(/^(Key|Digit)/, ''); }); };
        setupHotkeyInput(dashHotkeyInput, 'dashboardHotkey'); setupHotkeyInput(calHotkeyInput, 'calendarHotkey');
        document.getElementById('shp-settings-btn').addEventListener('click', () => { const panel = document.getElementById('shp-settings'); panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; });
        const inputToSettingMap = { 'hourly-rate-input': 'hourlyRateUSD', 'night-rate-input': 'nightRateMultiplier', 'oc-rate-input': 'ocRateMultiplier', 'as-rate-input': 'asRateMultiplier', 'sup-rate-input': 'supRateMultiplier', };
        Object.values(inputToSettingMap).forEach(key => document.getElementById(Object.keys(inputToSettingMap).find(k => inputToSettingMap[k] === key)).addEventListener('input', (e) => { const currentSettings = getSettings(); const val = parseFloat(e.target.value); currentSettings[key] = isNaN(val) ? (key === 'hourlyRateUSD' ? 0 : 1.0) : val; saveSettings(currentSettings); updateInfoPanels(); }));
        highlightCheck.addEventListener('change', () => { const currentSettings = getSettings(); currentSettings.highlightSupport = highlightCheck.checked; saveSettings(currentSettings); if (document.getElementById('sh-calendar-modal').style.display === 'flex') { buildScheduleView(displayedMonthState.year, displayedMonthState.month); } });
        document.getElementById('show-schedule-btn').addEventListener('click', () => { document.getElementById('sh-calendar-modal').style.display = 'flex'; const now = new Date(); buildScheduleView(now.getFullYear(), now.getMonth()); });
        document.getElementById('export-calendar-btn').addEventListener('click', initiateExportProcess);
        document.getElementById('delete-cache-btn').addEventListener('click', () => { if (confirm("Clear shift data cache? Your settings will be preserved.")) { GM_deleteValue(CACHE_KEY); location.reload(); } });
        document.getElementById('sh-calendar-modal').querySelector('.sh-modal-close').addEventListener('click', () => document.getElementById('sh-calendar-modal').style.display = 'none');
        document.getElementById('scsd-prev-month').addEventListener('click', () => { let { year, month } = displayedMonthState; month--; if (month < 0) { month = 11; year--; } buildScheduleView(year, month); });
        document.getElementById('scsd-next-month').addEventListener('click', () => { let { year, month } = displayedMonthState; month++; if (month > 11) { month = 0; year++; } buildScheduleView(year, month); });
        document.getElementById('scsd-export-options-modal').querySelector('#export-cancel-btn').addEventListener('click', () => document.getElementById('scsd-export-options-modal').style.display = 'none');
        document.getElementById('scsd-import-instructions-modal').querySelector('#instructions-ok-btn').addEventListener('click', () => document.getElementById('scsd-import-instructions-modal').style.display = 'none');
        document.getElementById('export-mine-btn').addEventListener('click', () => handleCalendarExport('mine'));
        document.getElementById('export-contextual-btn').addEventListener('click', () => handleCalendarExport('contextual'));
        document.getElementById('export-all-btn').addEventListener('click', () => handleCalendarExport('all'));
        document.addEventListener('keydown', (e) => { const settings = getSettings(); if ((e.ctrlKey || e.metaKey) && !/INPUT|TEXTAREA/.test(e.target.nodeName)) { if(e.code === settings.dashboardHotkey) { e.preventDefault(); const panel = document.getElementById('shift-helper-panel'); panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; } if(e.code === settings.calendarHotkey) { e.preventDefault(); const modal = document.getElementById('sh-calendar-modal'); const isOpening = modal.style.display !== 'flex'; modal.style.display = isOpening ? 'flex' : 'none'; if(isOpening) { const now = new Date(); buildScheduleView(now.getFullYear(), now.getMonth()); } } }});
        const bgColorPicker = document.getElementById('bg-color-picker'); const textColorPicker = document.getElementById('text-color-picker');
        bgColorPicker.addEventListener('input', () => { updateColorSetting('bg', bgColorPicker.value); }); textColorPicker.addEventListener('input', () => { updateColorSetting('text', textColorPicker.value); });
        document.getElementById('support-selector').addEventListener('change', (e) => { GM_setValue('selectedSupporterName', e.target.value); if (statusUpdateInterval) clearInterval(statusUpdateInterval); updateInfoPanels(); if(e.target.value) statusUpdateInterval = setInterval(updateInfoPanels, 1000); if (getSettings().highlightSupport && document.getElementById('sh-calendar-modal').style.display === 'flex') { buildScheduleView(displayedMonthState.year, displayedMonthState.month); } updateColorPanel(); });
        const injectionInterval = setInterval(() => { const targetSpan = document.querySelector('span[style*="font-size: 25px"]'); if (targetSpan) { clearInterval(injectionInterval); const parentLi = targetSpan.closest('li'); if (parentLi && !document.getElementById('scsd-navbar-injection')) { const navInjectionLi = document.createElement('li'); navInjectionLi.id = 'scsd-navbar-injection'; parentLi.parentNode.insertBefore(navInjectionLi, parentLi); updateInfoPanels(); } } }, 500);
        setTimeout(() => clearInterval(injectionInterval), 10000); updatePanelUI('Waiting for data...', 'waiting');
    }

    function updateColorPanel() { const colorPanel = document.getElementById('color-settings-panel'); const supporterName = document.getElementById('support-selector').value; if (!supporterName) { colorPanel.style.display = 'none'; return; } const settings = getSettings(); const customColors = settings.colorSettings[supporterName] || {}; document.getElementById('bg-color-picker').value = customColors.bg || '#908caa'; document.getElementById('text-color-picker').value = customColors.text || '#232136'; colorPanel.style.display = 'block'; }
    function updateColorSetting(type, value) { const supporterName = document.getElementById('support-selector').value; if (!supporterName) return; const settings = getSettings(); if (!settings.colorSettings[supporterName]) { settings.colorSettings[supporterName] = {}; } settings.colorSettings[supporterName][type] = value; saveSettings(settings); if (document.getElementById('sh-calendar-modal').style.display === 'flex') { buildScheduleView(displayedMonthState.year, displayedMonthState.month); } }
    function initialize() {
        createUI();
        interceptXHR();
        fetchAndCacheExchangeRate();
        const initialCache = GM_getValue(CACHE_KEY);
        if (initialCache) {
            const now = new Date();
            const currentMonthName = now.toLocaleString('default', { month: 'long' });
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const nextMonthName = nextMonth.toLocaleString('default', { month: 'long' });
            updatePanelUI(`Using cached data for <b>${currentMonthName} & ${nextMonthName}</b>.`, 'ok');
        } else {
            setTimeout(() => { if (!dataHasBeenIntercepted && !GM_getValue(CACHE_KEY)) { updatePanelUI('No shift data found on this page.', 'error'); } }, 15000);
        }
    }
    function updatePanelUI(statusMessage = '', statusType = 'waiting') {
        const cache = GM_getValue(CACHE_KEY);
        const hasCache = cache?.shifts?.length > 0;
        const panel = document.getElementById('shift-helper-panel');
        if (!panel) return;
        const infoDiv = panel.querySelector('#shp-info');
        const light = panel.querySelector('#shp-status-light');
        const viewBtn = panel.querySelector('#show-schedule-btn');
        const deleteBtn = panel.querySelector('#delete-cache-btn');
        const exportBtn = panel.querySelector('#export-calendar-btn');
        const statusPanel = panel.querySelector('#support-status-panel');
        light.className = 'shp-status-light';
        light.classList.add(statusType);
        if (hasCache) {
            infoDiv.innerHTML = statusMessage;
            [viewBtn, deleteBtn, exportBtn].forEach(btn => btn.disabled = false);
            buildSupportSelector(cache.shifts);
        } else {
            infoDiv.textContent = statusMessage || 'Waiting for shift data...';
            [viewBtn, deleteBtn, exportBtn].forEach(btn => btn.disabled = true);
            if (statusPanel) statusPanel.style.display = 'none';
        }
    }
    function buildSupportSelector(shifts) { const panel = document.getElementById('support-status-panel'); const selector = document.getElementById('support-selector'); if (!panel || !selector) return; const supporters = [...new Set(shifts.map(s => (s.title || '').match(/(.+?)\s+\(/)?.[1].trim()).filter(Boolean))].sort(); if (supporters.length > 0) { panel.style.display = 'block'; const currentSelection = selector.value; selector.innerHTML = '<option value="">-- Select Supporter --</option>' + supporters.map(name => `<option value="${name}">${name}</option>`).join(''); const savedName = GM_getValue('selectedSupporterName'); if (savedName && supporters.includes(savedName)) { selector.value = savedName; if (statusUpdateInterval) clearInterval(statusUpdateInterval); updateInfoPanels(); statusUpdateInterval = setInterval(updateInfoPanels, 1000); updateColorPanel(); } else { selector.value = currentSelection; updateInfoPanels(); updateColorPanel(); } } else { panel.style.display = 'none'; } }
    function processAndCacheShifts(responseData) {
        dataHasBeenIntercepted = true;
        let allShifts = responseData?.data?.shifts;
        if (!allShifts || !Array.isArray(allShifts)) {
            updatePanelUI('Error: Unrecognized data format.', 'error');
            return;
        }
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const endOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
        const filteredShifts = allShifts.filter(shift => {
            if (!shift.starts_at) return false;
            const shiftDate = new Date(shift.starts_at + 'Z');
            return !isNaN(shiftDate.getTime()) && shiftDate >= startOfMonth && shiftDate <= endOfNextMonth;
        });
        GM_setValue(CACHE_KEY, { timestamp: new Date().toISOString(), shifts: filteredShifts });
        const currentMonthName = now.toLocaleString('default', { month: 'long' });
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthName = nextMonth.toLocaleString('default', { month: 'long' });
        updatePanelUI(`Success! ${filteredShifts.length} shifts for <b>${currentMonthName} & ${nextMonthName}</b>.`, 'ok');
    }
    function interceptXHR() { const originalOpen = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(method, url) { this._url = url; originalOpen.apply(this, arguments); }; const originalSend = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function() { if (this._url?.startsWith(SHIFT_API_URL)) { updatePanelUI('API request detected...', 'waiting'); this.addEventListener('load', () => { if (this.status >= 200 && this.status < 300) { try { processAndCacheShifts(JSON.parse(this.responseText)); } catch (e) { updatePanelUI('Error parsing shift data.', 'error'); } } else { updatePanelUI(`API Error: ${this.status}`, 'error'); } }); this.addEventListener('error', () => updatePanelUI('Network error on API call.', 'error')); } originalSend.apply(this, arguments); }; }

    if (document.readyState === 'loading') { window.addEventListener('DOMContentLoaded', initialize); }
    else { initialize(); }
})();
