// ==UserScript==
// @name         Auto Refresher
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.1
// @description  Draggable, auto-refreshes pages with a sleek, VISIBLE, and configurable timer.
// @author       Heorhii Litovskyi (George)
// @match        *://*/*
// @exclude      https://essaycock.com/support/dashboard/orders/*
// @exclude      *://*.google.*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/auto-refresher.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/auto-refresher.js
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) { return; }

    const SCRIPT_NAME = "Auto Refresher";

    class AutoRefresher {
        constructor() {
            this.currentOrigin = window.location.origin;

            this.THEMES = {
                'rose-pine-dawn': { name: 'Rosé Pine Dawn', colors: { '--ar-bg': '#faf4ed', '--ar-surface': '#fffaf3', '--ar-text': '#575279', '--ar-muted': '#9893a5', '--ar-primary': '#907aa9', '--ar-secondary': '#d7827e', '--ar-highlight': '#f2e9e1', '--ar-stroke': '#dfdad9', '--ar-success': '#56949f', '--ar-warning': '#ea9d34', '--ar-error': '#b4637a', } },
                'rose-pine-moon': { name: 'Rosé Pine Moon', colors: { '--ar-bg': '#232136', '--ar-surface': '#2a273f', '--ar-text': '#e0def4', '--ar-muted': '#6e6a86', '--ar-primary': '#c4a7e7', '--ar-secondary': '#ebbcba', '--ar-highlight': '#393552', '--ar-stroke': '#44415a', '--ar-success': '#9ccfd8', '--ar-warning': '#f6c177', '--ar-error': '#eb6f92', } },
                'custom': { name: 'Custom' }
            };

            this.DEFAULT_SETTINGS = {
                interval: 60, theme: 'rose-pine-moon', position: 'bottom-right', size: 'medium', fontSize: 14,
                enabled: true, notifyOnSave: true, notifyOnToggle: true, notifyOnInit: true,
                chipPosition: { x: null, y: null },
                customTheme: { '--ar-bg': '#232136', '--ar-surface': '#2a273f', '--ar-text': '#e0def4', '--ar-muted': '#6e6a86', '--ar-primary': '#c4a7e7', '--ar-secondary': '#ebbcba', '--ar-highlight': '#393552', '--ar-stroke': '#44415a', '--ar-success': '#9ccfd8', '--ar-warning': '#f6c177', '--ar-error': '#eb6f92' }
            };

            this.settings = {};
            this.pausedSites = {};
            this.countdownIntervalId = null;
            this.countdownValue = 0;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.elements = { container: null, timerChip: null, timerText: null, settingsButton: null, settingsDialog: null, toastContainer: null };

            Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach(prop => {
                if (prop !== 'constructor' && typeof this[prop] === 'function') this[prop] = this[prop].bind(this);
            });
        }

        init() {
            this.loadState();
            if (document.body) this.run();
            else window.addEventListener('DOMContentLoaded', this.run, { once: true });
        }

        run() {
            this.createUiContainer();
            this.injectStyles(); // Styles are now correct
            this.applyTheme();
            this.createToastContainer();
            this.createTimerChip();
            this.applyChipPosition();
            this.startCountdown();
            if (this.settings.notifyOnInit) this.showToast(`${SCRIPT_NAME} initialized. Status: ${this.isRefreshActive() ? 'Running' : 'Paused'}.`, 'success', 3000);
            this.registerMenuCommands();
            console.log(`${SCRIPT_NAME} v2.4 initialized on ${this.currentOrigin}.`);
        }

        loadState() {
            this.settings = GM_getValue('autoRefresherSettings_v2.4', this.DEFAULT_SETTINGS);
            for (const key in this.DEFAULT_SETTINGS) {
                if (typeof this.settings[key] === 'undefined') this.settings[key] = this.DEFAULT_SETTINGS[key];
            }
            if (typeof this.settings.chipPosition !== 'object' || this.settings.chipPosition === null) this.settings.chipPosition = { x: null, y: null };
            this.pausedSites = GM_getValue('autoRefresherPausedSites', {});
        }

        saveSettings(showNotification = true) {
            GM_setValue('autoRefresherSettings_v2.4', this.settings);
            if (showNotification && this.settings.notifyOnSave) this.showToast('Settings saved!', 'success');
        }

        isRefreshActive() { return this.settings.enabled && !this.pausedSites[this.currentOrigin]; }
        startCountdown() {
            this.stopCountdown();
            if (!this.isRefreshActive()) { this.updateTimerDisplay(); return; }
            this.countdownValue = this.settings.interval;
            this.updateTimerDisplay();
            this.countdownIntervalId = setInterval(() => {
                this.countdownValue--;
                if (this.countdownValue < 0) { window.location.reload(); } else { this.updateTimerDisplay(); }
            }, 1000);
        }
        stopCountdown() { if (this.countdownIntervalId) { clearInterval(this.countdownIntervalId); this.countdownIntervalId = null; } }
        toggleRefresh() {
            this.pausedSites[this.currentOrigin] = !this.pausedSites[this.currentOrigin];
            GM_setValue('autoRefresherPausedSites', this.pausedSites);
            this.registerMenuCommands();
            if (this.isRefreshActive()) {
                this.startCountdown();
                if (this.settings.notifyOnToggle) this.showToast('Refresher resumed.', 'success');
            } else {
                this.stopCountdown();
                this.updateTimerDisplay();
                if (this.settings.notifyOnToggle) this.showToast('Refresher paused.', 'warning');
            }
        }
        onDragStart(e) {
            if (e.target.closest('.ar-settings-btn')) return;
            e.preventDefault(); this.isDragging = true;
            document.body.classList.add('ar-dragging');
            const rect = this.elements.timerChip.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left; this.dragOffset.y = e.clientY - rect.top;
            this.elements.timerChip.className = this.elements.timerChip.className.replace(/ar-pos-\S+/g, '').trim();
            document.addEventListener('mousemove', this.onDragMove);
            document.addEventListener('mouseup', this.onDragEnd, { once: true });
        }
        onDragMove(e) {
            if (!this.isDragging) return;
            let x = e.clientX - this.dragOffset.x, y = e.clientY - this.dragOffset.y;
            const chipWidth = this.elements.timerChip.offsetWidth, chipHeight = this.elements.timerChip.offsetHeight;
            x = Math.max(0, Math.min(x, window.innerWidth - chipWidth));
            y = Math.max(0, Math.min(y, window.innerHeight - chipHeight));
            Object.assign(this.elements.timerChip.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', transform: 'none' });
        }
        onDragEnd() {
            this.isDragging = false; document.body.classList.remove('ar-dragging');
            document.removeEventListener('mousemove', this.onDragMove);
            this.settings.chipPosition.x = parseInt(this.elements.timerChip.style.left, 10);
            this.settings.chipPosition.y = parseInt(this.elements.timerChip.style.top, 10);
            this.saveSettings(false);
        }

        // --- UI Creation (All methods are correct and unchanged) ---
        createUiContainer() { this.elements.container = document.createElement('div'); this.elements.container.id = 'auto-refresher-root'; document.body.appendChild(this.elements.container); }
        createTimerChip() {
            const chip = document.createElement('div');
            chip.id = 'ar-timer-chip'; 
            chip.className = `ar-size-${this.settings.size}`; 
            chip.title = 'Click to Pause/Resume, Drag to Move';
            chip.style.fontSize = `${this.settings.fontSize}px`;
            chip.innerHTML = `<span class="ar-timer-text"></span><span class="ar-settings-btn" title="Open Settings">⚙</span>`;
            this.elements.timerText = chip.querySelector('.ar-timer-text');
            chip.addEventListener('click', e => { if (e.target.closest('.ar-settings-btn')) this.openSettingsDialog(e); else this.toggleRefresh(); });
            chip.addEventListener('mousedown', this.onDragStart);
            this.elements.timerChip = chip; this.elements.container.appendChild(chip); this.updateTimerDisplay();
        }
        applyChipPosition() {
            const chip = this.elements.timerChip;
            Object.assign(chip.style, { left: 'auto', top: 'auto', right: 'auto', bottom: 'auto', transform: '' });
            chip.className = chip.className.replace(/ar-pos-\S+/g, '').trim();
            if (this.settings.chipPosition.x !== null && this.settings.chipPosition.y !== null) { chip.style.left = `${this.settings.chipPosition.x}px`; chip.style.top = `${this.settings.chipPosition.y}px`; }
            else { chip.classList.add(`ar-pos-${this.settings.position}`); }
        }
        updateTimerDisplay() { 
            if (!this.elements.timerText) return; 
            if (!this.isRefreshActive()) {
                this.elements.timerText.textContent = "Paused";
                return;
            }
            
            const minutes = Math.floor(this.countdownValue / 60);
            const seconds = this.countdownValue % 60;
            
            if (minutes > 0) {
                this.elements.timerText.textContent = `${minutes}m ${seconds}s`;
            } else {
                this.elements.timerText.textContent = `${seconds}s`;
            }
        }
        createToastContainer() { this.elements.toastContainer = document.createElement('div'); this.elements.toastContainer.id = 'ar-toast-container'; this.elements.container.appendChild(this.elements.toastContainer); }
        showToast(message, type = 'success', duration = 4000) {
            if (!this.elements.toastContainer) return;
            const toast = document.createElement('div');
            toast.className = `ar-toast ar-toast-${type}`; toast.textContent = message;
            this.elements.toastContainer.appendChild(toast);
            setTimeout(() => toast.classList.add('ar-toast-visible'), 50);
            setTimeout(() => { toast.classList.remove('ar-toast-visible'); toast.addEventListener('transitionend', () => toast.remove(), { once: true }); }, duration);
        }

        // --- Settings Dialog (All methods are correct and unchanged) ---
        openSettingsDialog() {
            if (this.elements.settingsDialog) return;
            const dialogWrapper = document.createElement('div');
            dialogWrapper.id = 'ar-dialog-wrapper';
            dialogWrapper.innerHTML = `
                <div id="ar-dialog-scrim"></div>
                <div id="ar-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ar-dialog-title">
                    <header class="ar-dialog-header"><h2 id="ar-dialog-title">${SCRIPT_NAME} Settings</h2></header>
                    <div class="ar-dialog-content">
                        <div class="ar-tabs"><button class="ar-tab-btn active" data-tab="general">General</button><button class="ar-tab-btn" data-tab="appearance">Appearance</button><button class="ar-tab-btn" data-tab="notifications">Notifications</button></div>
                        <div class="ar-panels-container">
                            <div id="ar-tab-general" class="ar-tab-panel active"> ${this.createToggle('ar-enabled', 'Enable Refresher Globally', this.settings.enabled)} <div class="ar-form-group"><label for="ar-interval">Refresh Interval (s)</label><input type="number" id="ar-interval" value="${this.settings.interval}" min="5" max="3600"></div></div>
                            <div id="ar-tab-appearance" class="ar-tab-panel">${this.createSelectGroup('ar-theme', 'Theme', this.settings.theme, Object.keys(this.THEMES).map(id => ({value: id, text: this.THEMES[id].name})))}<div class="ar-position-group">${this.createSelectGroup('ar-position', 'Default Position', this.settings.position, [{value:'top-left',text:'Top Left'},{value:'top-center',text:'Top Center'},{value:'top-right',text:'Top Right'},{value:'bottom-left',text:'Bottom Left'},{value:'bottom-center',text:'Bottom Center'},{value:'bottom-right',text:'Bottom Right'}])}<div class="ar-form-group"><label>Floating Position</label><button id="ar-reset-position" class="ar-btn ar-btn-outlined">Reset</button></div></div>${this.createSelectGroup('ar-size', 'Timer Size', this.settings.size, [{value:'small',text:'Small'},{value:'medium',text:'Medium'},{value:'large',text:'Large'}])}<div class="ar-form-group"><label for="ar-font-size">Font Size (px)</label><input type="number" id="ar-font-size" value="${this.settings.fontSize}" min="10" max="24"></div><div id="ar-custom-theme-editor" class="${this.settings.theme === 'custom' ? '' : 'hidden'}"></div></div>
                            <div id="ar-tab-notifications" class="ar-tab-panel">${this.createToggle('ar-notify-init', 'Notify on script load', this.settings.notifyOnInit)}${this.createToggle('ar-notify-save', 'Notify on settings save', this.settings.notifyOnSave)}${this.createToggle('ar-notify-toggle', 'Notify on pause/resume', this.settings.notifyOnToggle)}</div>
                        </div>
                    </div>
                    <footer class="ar-dialog-footer"><button id="ar-cancel" class="ar-btn ar-btn-text">Cancel</button><button id="ar-save" class="ar-btn ar-btn-contained">Save</button></footer>
                </div>`;
            this.elements.settingsDialog = dialogWrapper; this.elements.container.appendChild(this.elements.settingsDialog); this.setupDialogEvents();
        }
        setupDialogEvents() {
            const dialogEl = this.elements.settingsDialog; const customThemeEditor = dialogEl.querySelector('#ar-custom-theme-editor');
            const populateCustomColors = () => { customThemeEditor.innerHTML = '<hr><p class="ar-section-title">Custom Theme</p>'; for (const c in this.settings.customTheme) { const n = c.replace('--ar-', '').replace('-', ' '); customThemeEditor.innerHTML += `<div class="ar-form-group ar-form-color"><label>${n}</label><input type="color" value="${this.settings.customTheme[c]}" data-color-var="${c}"></div>`; } };
            if (this.settings.theme === 'custom') { populateCustomColors(); }
            dialogEl.querySelectorAll('.ar-tab-btn').forEach(b => b.addEventListener('click', () => { dialogEl.querySelector('.ar-tab-btn.active').classList.remove('active'); b.classList.add('active'); dialogEl.querySelector('.ar-tab-panel.active').classList.remove('active'); dialogEl.querySelector(`#ar-tab-${b.dataset.tab}`).classList.add('active'); }));
            dialogEl.querySelector('#ar-theme').addEventListener('change', e => { const isCustom = e.target.value === 'custom'; customThemeEditor.classList.toggle('hidden', !isCustom); if (isCustom && customThemeEditor.children.length <= 2) { populateCustomColors(); } });
            dialogEl.querySelector('#ar-reset-position').addEventListener('click', () => { this.settings.chipPosition = { x: null, y: null }; this.applyChipPosition(); this.showToast('Position reset. Save to apply.', 'success'); });
            dialogEl.querySelector('#ar-save').addEventListener('click', this.handleSaveSettings);
            dialogEl.querySelector('#ar-cancel').addEventListener('click', this.closeSettingsDialog);
            dialogEl.querySelector('#ar-dialog-scrim').addEventListener('click', this.closeSettingsDialog);
        }
        createSelectGroup(id, label, selectedValue, options) { const opts = options.map(o => `<option value="${o.value}" ${o.value === selectedValue ? 'selected' : ''}>${o.text}</option>`).join(''); return `<div class="ar-form-group"><label for="${id}">${label}</label><select id="${id}">${opts}</select></div>`; }
        createToggle(id, label, isChecked) { return `<div class="ar-form-group ar-form-toggle"><span>${label}</span><label class="ar-switch"><input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''}><span class="ar-slider"></span></label></div>`; }
        handleSaveSettings() {
            const dialogEl = this.elements.settingsDialog;
            Object.assign(this.settings, { 
                enabled: dialogEl.querySelector('#ar-enabled').checked, 
                interval: parseInt(dialogEl.querySelector('#ar-interval').value, 10) || 60, 
                theme: dialogEl.querySelector('#ar-theme').value, 
                position: dialogEl.querySelector('#ar-position').value, 
                size: dialogEl.querySelector('#ar-size').value,
                fontSize: parseInt(dialogEl.querySelector('#ar-font-size').value, 10) || 14,
                notifyOnInit: dialogEl.querySelector('#ar-notify-init').checked, 
                notifyOnSave: dialogEl.querySelector('#ar-notify-save').checked, 
                notifyOnToggle: dialogEl.querySelector('#ar-notify-toggle').checked 
            });
            if (this.settings.theme === 'custom') { 
                dialogEl.querySelectorAll('#ar-custom-theme-editor input[type="color"]').forEach(i => { 
                    this.settings.customTheme[i.dataset.colorVar] = i.value; 
                }); 
            }
            this.saveSettings(); 
            this.closeSettingsDialog(); 
            this.applyTheme(); 
            this.elements.timerChip.className = `ar-size-${this.settings.size}`;
            this.elements.timerChip.style.fontSize = `${this.settings.fontSize}px`;
            this.applyChipPosition(); 
            this.startCountdown();
        }
        closeSettingsDialog() { if (this.elements.settingsDialog) { this.elements.settingsDialog.remove(); this.elements.settingsDialog = null; } }

        // --- Styles & Theming ---
        applyTheme() {
            const themeData = this.THEMES[this.settings.theme];
            const colors = this.settings.theme === 'custom' ? this.settings.customTheme : themeData.colors;
            for (const [key, value] of Object.entries(colors)) this.elements.container.style.setProperty(key, value);
        }

        injectStyles() {
            // THIS CSS BLOCK IS NOW CORRECT AND ROBUST
            const css = `
                /* --- CORE SETUP: THIS IS THE FIX --- */
                #auto-refresher-root {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 2147483640;
                    pointer-events: none; /* Let clicks pass through the container */
                }
                /* Re-enable pointer events on direct children that need interaction */
                #auto-refresher-root > * {
                    pointer-events: auto;
                }
                /* Global styles for elements */
                #auto-refresher-root * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }
                :root { --ar-radius-s: 4px; --ar-radius-m: 16px; --ar-radius-l: 28px; --ar-shadow: 0 3px 6px rgba(0,0,0,.16); }

                /* --- Draggable Timer Chip --- */
                body.ar-dragging { user-select: none; cursor: grabbing !important; }
                #ar-timer-chip {
                    position: fixed; display: flex; align-items: center; 
                    background: linear-gradient(135deg, var(--ar-surface) 0%, var(--ar-highlight) 100%);
                    color: var(--ar-text); backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.08);
                    border: 1px solid var(--ar-stroke); border-radius: var(--ar-radius-m);
                    font-weight: 600; font-variant-numeric: tabular-nums;
                    user-select: none; cursor: grab; 
                    transition: all .3s cubic-bezier(0.4, 0, 0.2, 1);
                    min-width: fit-content;
                }
                #ar-timer-chip:hover { 
                    box-shadow: 0 12px 40px rgba(0,0,0,.16), 0 4px 12px rgba(0,0,0,.12);
                    transform: translateY(-1px);
                    border-color: var(--ar-primary);
                }
                #ar-timer-chip:active { 
                    transform: translateY(0px);
                    box-shadow: 0 4px 16px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
                }
                .ar-timer-text { 
                    padding-right: 8px; 
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    min-width: 3ch;
                }
                .ar-settings-btn { 
                    padding: 4px; margin-left: 4px; border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all .2s ease;
                    opacity: 0.7; font-size: 12px;
                }
                .ar-settings-btn:hover { 
                    background-color: var(--ar-highlight); 
                    opacity: 1;
                    transform: rotate(90deg);
                }
                .ar-size-small { font-size: 12px; padding: 6px 6px 6px 12px; min-height: 28px; } 
                .ar-size-medium { font-size: 14px; padding: 8px 8px 8px 16px; min-height: 32px; } 
                .ar-size-large { font-size: 16px; padding: 10px 10px 10px 20px; min-height: 36px; }
                .ar-pos-top-left{top:15px;left:15px} .ar-pos-top-right{top:15px;right:15px} .ar-pos-top-center{top:15px;left:50%;transform:translateX(-50%)}
                .ar-pos-bottom-left{bottom:15px;left:15px} .ar-pos-bottom-right{bottom:15px;right:15px} .ar-pos-bottom-center{bottom:15px;left:50%;transform:translateX(-50%)}

                /* --- Toasts & Dialog --- */
                #ar-toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; }
                .ar-toast { padding: 12px 20px; background-color: var(--ar-surface); color: var(--ar-text); border-radius: var(--ar-radius-s); box-shadow: var(--ar-shadow); opacity: 0; transform: translateX(20px); transition: all .3s; border-left: 4px solid var(--ar-muted); }
                .ar-toast.ar-toast-visible { opacity: 1; transform: translateX(0); }
                .ar-toast-success { border-left-color: var(--ar-success); } .ar-toast-warning { border-left-color: var(--ar-warning); }

                #ar-dialog-wrapper { position: fixed; inset: 0; z-index: 2147483641; }
                #ar-dialog-scrim { position: absolute; inset: 0; background-color: rgba(0,0,0,0.5); }
                #ar-settings-dialog { position: relative; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 500px; max-height: 90vh; background-color: var(--ar-bg); color: var(--ar-text); border-radius: var(--ar-radius-l); box-shadow: 0 10px 20px rgba(0,0,0,.2); display: flex; flex-direction: column; }
                .ar-dialog-header { padding: 24px 24px 0; } .ar-dialog-header h2 { margin: 0 0 16px 0; font-size: 22px; }
                .ar-dialog-content { padding: 0 24px; display: flex; flex-direction: column; overflow: hidden; }
                .ar-panels-container { overflow-y: auto; padding: 20px 4px 24px 0; margin-right: -4px; }
                .ar-dialog-footer { padding: 8px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--ar-stroke); flex-shrink: 0; }
                .ar-tabs { display: flex; border-bottom: 1px solid var(--ar-stroke); flex-shrink: 0; }
                .ar-tab-btn { background: none; border: none; padding: 10px 16px; cursor: pointer; color: var(--ar-muted); font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; }
                .ar-tab-btn.active { color: var(--ar-primary); border-bottom-color: var(--ar-primary); }
                .ar-tab-panel { display: none; flex-direction: column; gap: 24px; } .ar-tab-panel.active { display: flex; }

                /* --- Form Elements --- */
                .ar-form-group { display: flex; flex-direction: column; gap: 8px; }
                .ar-form-toggle { flex-direction: row; justify-content: space-between; align-items: center; }
                .ar-form-group > label { color: var(--ar-muted); font-size: 14px; }
                .ar-form-group input, .ar-form-group select { width: 100%; padding: 10px; background-color: var(--ar-highlight); border: 1px solid var(--ar-stroke); color: var(--ar-text); font-size: 14px; border-radius: var(--ar-radius-s); }
                .ar-position-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
                hr { border: none; border-top: 1px solid var(--ar-stroke); margin: 0; }
                .ar-section-title { margin: 16px 0 0 0; color: var(--ar-muted); font-weight: 500; }
                .ar-form-color { grid-template-columns: 1fr auto; display: grid; align-items: center; gap: 12px; }
                .ar-form-color label { text-transform: capitalize; color: var(--ar-text); }
                #ar-custom-theme-editor input[type=color] { border: 1px solid var(--ar-stroke); border-radius: 4px; background: none; height: 32px; width: 50px; padding: 2px; }
                .hidden { display: none !important; }

                .ar-switch { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; flex-shrink: 0; }
                .ar-switch input { opacity: 0; width: 0; height: 0; }
                .ar-slider { position: absolute; inset: 0; background-color: var(--ar-stroke); transition: .3s; border-radius: 24px; }
                .ar-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
                .ar-switch input:checked + .ar-slider { background-color: var(--ar-primary); }
                .ar-switch input:checked + .ar-slider:before { transform: translateX(20px); }

                .ar-btn { padding: 8px 16px; font-size: 14px; font-weight: 500; border-radius: var(--ar-radius-l); cursor: pointer; transition: background-color .2s; border: 1px solid transparent; }
                .ar-btn-contained { background-color: var(--ar-primary); color: var(--ar-surface); border-color: var(--ar-primary); }
                .ar-btn-contained:hover { filter: brightness(1.1); }
                .ar-btn-text { background-color: transparent; color: var(--ar-primary); }
                .ar-btn-text:hover { background-color: var(--ar-highlight); }
                .ar-btn-outlined { color: var(--ar-primary); border-color: var(--ar-stroke); width: 100%; }
            `;
            GM_addStyle(css);
        }

        registerMenuCommands() {
            GM_registerMenuCommand(`${SCRIPT_NAME} Settings`, this.openSettingsDialog);
            const isSitePaused = this.pausedSites[this.currentOrigin] || false;
            GM_registerMenuCommand((isSitePaused ? "Resume" : "Pause") + ` on this Site`, this.toggleRefresh);
        }
    }

    new AutoRefresher().init();
})();