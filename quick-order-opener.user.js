// ==UserScript==
// @name         Quick Order Opener (alt + o)
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.1
// @description  Opens order pages from selected text/clipboard. Works on all sites with robust hotkey management.
// @author       Heorhii Litovskyi (George)
// @match        *://*/*
// @grant        GM_openInTab
// @grant        GM_getClipboard
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/quick-order-opener.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/quick-order-opener.js
// ==/UserScript==

(function() {
    'use strict';

    // =================================================================================
    // --- MODULE 1: CONFIGURATION & CONSTANTS ---
    // =================================================================================
    const Config = {
        SCRIPT_NAME: 'Definitive Quick Order Opener',
        LOG_PREFIX: '[QOO]',
        DEFAULTS: {
            urlTemplate: 'https://essaycock.com/support/dashboard/orders/{ORDER_ID}',
            keybinding: 'alt+KeyO',
            theme: 'rose-pine-dawn',
            enableGmailPreview: true,
            panelPosition: 'top-right',
            customTheme: { bg: '#2a273f', surface: '#232136', text: '#e0def4', primary: '#eb6f92' }
        },
        IS_MAC: navigator.platform.toLowerCase().includes('mac'),
        KEYS: {
            urlTemplate: 'qoo_urlTemplate_v4',
            keybinding: 'qoo_keybinding_v4',
            theme: 'qoo_theme_v4',
            enableGmailPreview: 'qoo_enableGmailPreview_v4',
            panelPosition: 'qoo_panelPosition_v4',
            customTheme: 'qoo_customTheme_v4',
            gmailPreviewContent: 'qoo_gmailPreviewContent_v4',
            lastPanelPosition: 'qoo_lastPanelPosition_v4',
        },
        GMAIL_BODY_SELECTORS: ['div.a3s.aiL', 'div.a3s.aiO', '.gs .ii.gt'],
        STATUS_DURATION: 3000, // Increased duration for the new message
    };

    const Logger = {
        log: (message, ...args) => console.log(`${Config.LOG_PREFIX} ${message}`, ...args),
        error: (message, ...args) => console.error(`${Config.LOG_PREFIX} ${message}`, ...args),
    };

    // =================================================================================
    // --- MODULE 2: CORE LOGIC ---
    // =================================================================================
    const Core = {
        async findOrderId() {
            const regex = /\d{5,10}/;
            const selection = window.getSelection().toString();
            let match = selection.match(regex);
            if (match) return match[0];
            try {
                const clipboard = await GM_getClipboard();
                match = clipboard.match(regex);
                if (match) return match[0];
            } catch (err) {
                Logger.error('Failed to read clipboard:', err);
            }
            return null;
        },

        getSourceContext() {
            const { hostname, pathname } = window.location;
            if (hostname.includes('livechatinc.com')) {
                // Regex to capture the chat ID from URLs like /chats/open/SX2P9MOFQV
                const match = pathname.match(/^\/chats\/[^\/]+\/([^\/?#]+)/);
                return { source: 'livechat', chatId: match ? match[1] : null };
            }
            if (hostname.includes('mail.google.com')) {
                return { source: 'gmail', chatId: null };
            }
            return { source: 'generic', chatId: null };
        },

        async handleGmailPreview() {
            if (!await GM_getValue(Config.KEYS.enableGmailPreview, true)) return;
            const emailBody = Config.GMAIL_BODY_SELECTORS.map(s => document.querySelector(s)).find(el => el);
            if (emailBody) {
                await GM_setValue(Config.KEYS.gmailPreviewContent, emailBody.outerHTML);
            }
        },

        async handleActivation() {
            App.UI.showStatus('Working...', 'working');
            const orderId = await this.findOrderId();
            if (!orderId) {
                App.UI.showStatus('No valid Order ID found', 'error');
                return;
            }
            const { source, chatId } = this.getSourceContext();
            if (source === 'gmail') {
                await this.handleGmailPreview();
            }
            const urlTemplate = await GM_getValue(Config.KEYS.urlTemplate, Config.DEFAULTS.urlTemplate);
            try {
                const baseUrl = urlTemplate.replace('{ORDER_ID}', orderId);
                const finalUrl = new URL(baseUrl);
                finalUrl.searchParams.set('from', source);

                let successMessage = `Opening Order #${orderId}`;

                if (chatId) {
                    finalUrl.searchParams.set('chat_id', chatId);
                    // --- NEW: Copy chat ID to clipboard ---
                    try {
                        await GM_setClipboard(chatId);
                        successMessage += ` (Chat ID Copied)`;
                        Logger.log(`Copied Chat ID to clipboard: ${chatId}`);
                    } catch (err) {
                        Logger.error('Failed to copy Chat ID to clipboard:', err);
                        successMessage += ` (Copy Failed)`;
                    }
                    // --- END NEW ---
                }

                App.UI.showStatus(successMessage, 'success');
                GM_openInTab(finalUrl.href, { active: true, setParent: true });
            } catch (e) {
                Logger.error("Failed to construct URL. Is the template in settings valid?", e);
                App.UI.showStatus("Invalid URL Template in Settings", 'error');
            }
        }
    };

    // =================================================================================
    // --- MODULE 3: MAIN APPLICATION (UI & INITIALIZATION) ---
    // =================================================================================
    const App = {
        UI: {
            statusIndicator: null,
            activePanel: null,

            buildElement(tag, { className, textContent, attributes, children }) {
                const el = document.createElement(tag);
                if (className) el.className = className;
                if (textContent) el.textContent = textContent;
                if (attributes) Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
                if (children) children.forEach(child => el.appendChild(child));
                return el;
            },

            showStatus(message, state = 'working') {
                if (this.statusIndicator) this.statusIndicator.remove();
                this.statusIndicator = this.buildElement('div', { className: `qoo-status-indicator qoo-state-${state}`, children: [ this.buildElement('span', { className: 'qoo-icon' }), this.buildElement('span', { textContent: message }) ] });
                document.body.appendChild(this.statusIndicator);
                void this.statusIndicator.offsetWidth;
                this.statusIndicator.classList.add('visible');
                if (state !== 'working') {
                    setTimeout(() => {
                        this.statusIndicator?.classList.remove('visible');
                        this.statusIndicator?.addEventListener('transitionend', () => this.statusIndicator?.remove(), { once: true });
                    }, Config.STATUS_DURATION);
                }
            },

            closeActivePanel() {
                if (this.activePanel) {
                    this.activePanel.remove();
                    this.activePanel = null;
                }
            },

            makePanelDraggable(panel) {
                const header = panel.querySelector('.qoo-header');
                if (!header) return;
                header.onmousedown = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    e.preventDefault();
                    let shiftX = e.clientX - panel.getBoundingClientRect().left;
                    let shiftY = e.clientY - panel.getBoundingClientRect().top;
                    const moveAt = (pageX, pageY) => {
                        panel.style.left = `${pageX - shiftX}px`;
                        panel.style.top = `${pageY - shiftY}px`;
                        panel.style.transform = 'none';
                    };
                    const onMouseMove = (event) => moveAt(event.pageX, event.pageY);
                    const onMouseUp = async () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        await GM_setValue(Config.KEYS.lastPanelPosition, { top: panel.style.top, left: panel.style.left });
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                };
            },

            async createPanel(title, content) {
                this.closeActivePanel();
                const theme = await GM_getValue(Config.KEYS.theme, Config.DEFAULTS.theme);
                const panel = this.buildElement('div', {
                    className: `qoo-panel qoo-theme-${theme}`,
                    children: [ this.buildElement('div', { className: 'qoo-header', children: [ this.buildElement('h3', { textContent: title }), this.buildElement('button', { className: 'qoo-close-btn', textContent: '×', attributes: { 'data-action': 'close-panel' } }) ]}), content ]
                });
                const lastPos = await GM_getValue(Config.KEYS.lastPanelPosition, null);
                if (lastPos && lastPos.top && lastPos.left) {
                    panel.style.top = lastPos.top;
                    panel.style.left = lastPos.left;
                    panel.style.transform = 'none';
                } else {
                    panel.classList.add(`qoo-position-${await GM_getValue(Config.KEYS.panelPosition, Config.DEFAULTS.panelPosition)}`);
                }
                this.activePanel = panel;
                document.body.appendChild(panel);
                this.makePanelDraggable(panel);
                return panel;
            },

            async createSettingsPanel() {
                Logger.log('Creating settings panel...');
                try {
                    const storedCustomTheme = await GM_getValue(Config.KEYS.customTheme, Config.DEFAULTS.customTheme);
                    const urlInput = this.buildElement('input', { attributes: { type: 'text', id: 'qoo-url-template', value: await GM_getValue(Config.KEYS.urlTemplate, Config.DEFAULTS.urlTemplate) } });
                    
                    // Interactive keybinding recorder
                    const currentKeybinding = await GM_getValue(Config.KEYS.keybinding, Config.DEFAULTS.keybinding);
                    Logger.log('Current keybinding:', currentKeybinding);
                    const keybindingDisplay = this.buildElement('div', { 
                        className: 'qoo-keybinding-display', 
                        textContent: this.formatKeybinding(currentKeybinding),
                        attributes: { id: 'qoo-keybinding-display', 'data-keybinding': currentKeybinding }
                    });
                const recordBtn = this.buildElement('button', { 
                    className: 'qoo-record-btn', 
                    textContent: 'Record New Hotkey',
                    attributes: { type: 'button', 'data-action': 'record-keybinding' }
                });
                const keybindingContainer = this.buildElement('div', { 
                    className: 'qoo-keybinding-container',
                    children: [keybindingDisplay, recordBtn]
                });
                
                const themeSelect = this.buildElement('select', { attributes: { id: 'qoo-theme' }, children: [ this.buildElement('option', { attributes: { value: 'rose-pine-dawn' }, textContent: 'Rosé Pine Dawn' }), this.buildElement('option', { attributes: { value: 'rose-pine-moon' }, textContent: 'Rosé Pine Moon' }), this.buildElement('option', { attributes: { value: 'custom' }, textContent: 'Custom' }) ]});
                themeSelect.value = await GM_getValue(Config.KEYS.theme, Config.DEFAULTS.theme);
                const positionSelect = this.buildElement('select', { attributes: { id: 'qoo-panel-position' }, children: [ this.buildElement('option', { attributes: { value: 'top-right' }, textContent: 'Top Right' }), this.buildElement('option', { attributes: { value: 'top-left' }, textContent: 'Top Left' }), this.buildElement('option', { attributes: { value: 'center' }, textContent: 'Center' }), this.buildElement('option', { attributes: { value: 'bottom-right' }, textContent: 'Bottom Right' }), this.buildElement('option', { attributes: { value: 'bottom-left' }, textContent: 'Bottom Left' }) ]});
                positionSelect.value = await GM_getValue(Config.KEYS.panelPosition, Config.DEFAULTS.panelPosition);
                const gmailCheckbox = this.buildElement('input', { attributes: { type: 'checkbox', id: 'qoo-gmail-preview' }});
                if (await GM_getValue(Config.KEYS.enableGmailPreview, Config.DEFAULTS.enableGmailPreview)) gmailCheckbox.checked = true;

                const customThemeFields = this.buildElement('div', { id: 'qoo-custom-theme-fields', className: 'qoo-custom-theme-fields', children: Object.entries(Config.DEFAULTS.customTheme).map(([key, defaultValue]) =>
                    this.buildElement('div', { children: [
                        this.buildElement('label', { textContent: key.replace(/_/g, ' ') }),
                        this.buildElement('input', { attributes: { type: 'color', id: `qoo-custom-${key}`, value: storedCustomTheme[key] || defaultValue }})
                    ]})
                )});
                if(themeSelect.value !== 'custom') customThemeFields.style.display = 'none';
                themeSelect.onchange = () => { customThemeFields.style.display = themeSelect.value === 'custom' ? 'grid' : 'none'; };

                const content = this.buildElement('div', { className: 'qoo-content', children: [
                    this.buildElement('div', { className: 'qoo-settings-form', children: [
                        this.buildElement('label', { textContent: 'Order Page URL Template' }), urlInput, this.buildElement('div', { className: 'qoo-note', children: [ this.buildElement('span', { textContent: 'Use ' }), this.buildElement('code', { textContent: '{ORDER_ID}' }), this.buildElement('span', { textContent: ' as a placeholder.' }) ] }),
                        this.buildElement('label', { textContent: 'Keyboard Shortcut' }), keybindingContainer, this.buildElement('div', { className: 'qoo-note', textContent: 'Click "Record New Hotkey" and press your desired key combination. Works with any keyboard layout (QWERTY, AZERTY, Russian, etc.). Requires page reload.' }),
                        this.buildElement('label', { textContent: 'Initial Panel Position' }), positionSelect, this.buildElement('div', { className: 'qoo-note', textContent: 'The panel will remember its last dragged position.' }),
                        this.buildElement('label', { textContent: 'Theme' }), themeSelect, customThemeFields,
                        this.buildElement('div', { className: 'qoo-toggle', children: [ gmailCheckbox, this.buildElement('span', { textContent: 'Enable Gmail Preview' }) ] })
                    ]}),
                    this.buildElement('div', { className: 'qoo-footer', children: [ this.buildElement('button', { className: 'qoo-save-btn', textContent: 'Save & Close', attributes: { 'data-action': 'save-settings' } }) ]})
                ]});

                Logger.log('About to create panel...');
                const panel = await this.createPanel(`${Config.SCRIPT_NAME} Settings`, content);
                Logger.log('Settings panel created successfully');
                
                // Debug: Check panel position and visibility
                if (panel) {
                    const rect = panel.getBoundingClientRect();
                    const computedStyle = window.getComputedStyle(panel);
                    Logger.log('Panel position:', {
                        top: panel.style.top || 'auto',
                        left: panel.style.left || 'auto',
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        zIndex: computedStyle.zIndex,
                        opacity: computedStyle.opacity
                    });
                    
                    // Force visibility if needed
                    if (rect.x < 0 || rect.y < 0 || rect.x > window.innerWidth || rect.y > window.innerHeight) {
                        Logger.log('Panel appears to be off-screen, repositioning...');
                        panel.style.position = 'fixed';
                        panel.style.top = '50%';
                        panel.style.left = '50%';
                        panel.style.transform = 'translate(-50%, -50%)';
                        panel.style.zIndex = '999999';
                    }
                }
                } catch (error) {
                    Logger.error('Error in createSettingsPanel:', error);
                    console.error('Settings panel creation error:', error);
                }
            },

            formatKeybinding(keybinding) {
                if (!keybinding) return 'None';
                return keybinding.split('+').map(key => {
                    switch(key.toLowerCase()) {
                        case 'ctrl': return Config.IS_MAC ? '⌃' : 'Ctrl';
                        case 'cmd': return '⌘';
                        case 'shift': return Config.IS_MAC ? '⇧' : 'Shift';
                        case 'alt': return Config.IS_MAC ? '⌥' : 'Alt';
                        case 'meta': return Config.IS_MAC ? '⌘' : 'Win';
                        // Handle key codes for layout independence
                        default: 
                            if (key.startsWith('Key')) {
                                return key.slice(3).toUpperCase(); // KeyO -> O
                            } else if (key.startsWith('Digit')) {
                                return key.slice(5); // Digit1 -> 1
                            } else if (key.startsWith('F') && /^F\d+$/.test(key)) {
                                return key.toUpperCase(); // F1, F2, etc.
                            } else {
                                // Handle special keys
                                const specialKeys = {
                                    'Space': 'Space',
                                    'Enter': 'Enter',
                                    'Escape': 'Esc',
                                    'Tab': 'Tab',
                                    'Backspace': 'Backspace',
                                    'Delete': 'Del',
                                    'ArrowUp': '↑',
                                    'ArrowDown': '↓',
                                    'ArrowLeft': '←',
                                    'ArrowRight': '→'
                                };
                                return specialKeys[key] || key.toUpperCase();
                            }
                    }
                }).join(Config.IS_MAC ? '' : '+');
            },

            startKeybindingRecording() {
                const display = document.getElementById('qoo-keybinding-display');
                const recordBtn = document.querySelector('[data-action="record-keybinding"]');
                
                if (!display || !recordBtn) return;
                
                display.textContent = 'Press a key combination...';
                display.className = 'qoo-keybinding-display qoo-recording';
                recordBtn.textContent = 'Recording...';
                recordBtn.disabled = true;
                
                const recordingHandler = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const keys = [];
                    if (event.ctrlKey) keys.push('ctrl');
                    if (event.metaKey) keys.push(Config.IS_MAC ? 'cmd' : 'meta');
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
                        
                        display.textContent = this.formatKeybinding(newKeybinding);
                        display.dataset.keybinding = newKeybinding;
                        display.className = 'qoo-keybinding-display qoo-success';
                        
                        recordBtn.textContent = 'Record New Hotkey';
                        recordBtn.disabled = false;
                        
                        document.removeEventListener('keydown', recordingHandler, true);
                        
                        setTimeout(() => {
                            display.className = 'qoo-keybinding-display';
                        }, 2000);
                    } else if (event.key === 'Escape') {
                        // Cancel recording
                        display.textContent = this.formatKeybinding(display.dataset.keybinding);
                        display.className = 'qoo-keybinding-display';
                        recordBtn.textContent = 'Record New Hotkey';
                        recordBtn.disabled = false;
                        document.removeEventListener('keydown', recordingHandler, true);
                    }
                };
                
                document.addEventListener('keydown', recordingHandler, true);
                
                // Auto-cancel after 10 seconds
                setTimeout(() => {
                    if (recordBtn.disabled) {
                        display.textContent = this.formatKeybinding(display.dataset.keybinding);
                        display.className = 'qoo-keybinding-display';
                        recordBtn.textContent = 'Record New Hotkey';
                        recordBtn.disabled = false;
                        document.removeEventListener('keydown', recordingHandler, true);
                    }
                }, 10000);
            },

            async displayGmailPreviewPanel() {
                const previewHtmlString = await GM_getValue(Config.KEYS.gmailPreviewContent, null);
                if (!previewHtmlString) return;
                
                // Create a non-blocking email preview overlay
                const contentWrapper = this.buildElement('div', { className: 'qoo-content qoo-gmail-preview-content' });
                contentWrapper.innerHTML = previewHtmlString;
                
                // Create a collapsible preview panel that doesn't block the main content
                const previewPanel = await this.createNonBlockingPanel('Email Preview', contentWrapper);
                
                // Auto-clear the preview content
                await GM_setValue(Config.KEYS.gmailPreviewContent, null);
                
                // Auto-hide after 30 seconds to avoid clutter
                setTimeout(() => {
                    if (previewPanel && previewPanel.parentNode) {
                        previewPanel.style.opacity = '0.7';
                        previewPanel.style.transform = previewPanel.style.transform + ' scale(0.9)';
                    }
                }, 30000);
            },

            async createNonBlockingPanel(title, content) {
                // Don't close existing panels - this should be additive
                const theme = await GM_getValue(Config.KEYS.theme, Config.DEFAULTS.theme);
                const panel = this.buildElement('div', {
                    className: `qoo-panel qoo-gmail-preview qoo-theme-${theme}`,
                    children: [ 
                        this.buildElement('div', { className: 'qoo-header qoo-preview-header', children: [ 
                            this.buildElement('h3', { textContent: title }),
                            this.buildElement('div', { className: 'qoo-preview-controls', children: [
                                this.buildElement('button', { className: 'qoo-minimize-btn', textContent: '−', attributes: { 'data-action': 'minimize-preview', title: 'Minimize' } }),
                                this.buildElement('button', { className: 'qoo-close-btn', textContent: '×', attributes: { 'data-action': 'close-preview', title: 'Close' } })
                            ]})
                        ]}), 
                        content 
                    ]
                });
                
                // Position it in a non-blocking way (bottom-right corner, smaller size)
                panel.style.position = 'fixed';
                panel.style.bottom = '20px';
                panel.style.right = '20px';
                panel.style.width = 'min(40vw, 400px)';
                panel.style.maxHeight = '60vh';
                panel.style.zIndex = '10000';
                panel.style.transition = 'all 0.3s ease';
                
                document.body.appendChild(panel);
                this.makePanelDraggable(panel);
                
                return panel;
            },

            injectStyles() { GM_addStyle(`
                :root { --qoo-bg: #fffaf3; --qoo-surface: #f2e9e1; --qoo-text: #575279; --qoo-primary: #56949f; }
                body[data-qoo-theme="rose-pine-moon"] { --qoo-bg: #2a273f; --qoo-surface: #393552; --qoo-text: #e0def4; --qoo-primary: #3e8fb0; }
                body[data-qoo-theme="custom"] { /* Dynamically set */ }
                .qoo-status-indicator { position: fixed; top: 10px; left: 50%; transform: translateX(-50%) translateY(-150%); padding: 8px 16px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10001; display: flex; align-items: center; gap: 10px; transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2); font-family: sans-serif; font-size: 14px; backdrop-filter: blur(5px); background: var(--qoo-surface); color: var(--qoo-text); border: 1px solid var(--qoo-primary); }
                .qoo-status-indicator.visible { transform: translateX(-50%) translateY(0); }
                .qoo-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
                .qoo-state-working .qoo-icon::before { content: ''; width: 12px; height: 12px; border: 2px solid var(--qoo-primary); border-top-color: transparent; border-radius: 50%; animation: qoo-spin 1s linear infinite; }
                .qoo-state-success .qoo-icon::before { content: '✔'; color: #34A853; font-weight: bold; }
                .qoo-state-error .qoo-icon::before { content: '✖'; color: #EA4335; font-weight: bold; }
                @keyframes qoo-spin { to { transform: rotate(360deg); } }
                .qoo-panel { position: fixed !important; width: min(90vw, 500px); max-height: 80vh; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); z-index: 999999 !important; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--qoo-bg); color: var(--qoo-text); border: 1px solid var(--qoo-surface); opacity: 1 !important; visibility: visible !important; }
                .qoo-panel:not(.qoo-gmail-preview)::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.3); z-index: -1; }
                .qoo-position-center { top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; } .qoo-position-top-right { top: 20px !important; right: 20px !important; } .qoo-position-top-left { top: 20px !important; left: 20px !important; } .qoo-position-bottom-right { bottom: 20px !important; right: 20px !important; } .qoo-position-bottom-left { bottom: 20px !important; left: 20px !important; }
                .qoo-panel .qoo-header { padding: 10px 15px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--qoo-surface); flex-shrink: 0; background: var(--qoo-surface); }
                .qoo-panel .qoo-header h3 { margin: 0; font-size: 1.1em; } .qoo-panel .qoo-close-btn { font-size: 1.5em; line-height: 1; border: none; background: transparent; cursor: pointer; color: var(--qoo-text); opacity: 0.7; }
                .qoo-panel .qoo-close-btn:hover { opacity: 1; }
                .qoo-panel .qoo-content { padding: 20px; overflow-y: auto; }
                .qoo-panel .qoo-footer { padding: 10px 20px; text-align: right; border-top: 1px solid var(--qoo-surface); flex-shrink: 0; background: var(--qoo-surface); }
                .qoo-panel button.qoo-save-btn { padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px; font-weight: bold; background: var(--qoo-primary); color: var(--qoo-bg); }
                .qoo-settings-form label { display: block; margin: 15px 0 5px; font-weight: bold; }
                .qoo-settings-form input, .qoo-settings-form select { background: transparent; border: 1px solid var(--qoo-surface); color: var(--qoo-text); border-radius: 4px; padding: 8px; width: 100%; box-sizing: border-box; }
                .qoo-settings-form .qoo-note { font-size: 0.8em; margin-top: 5px; opacity: 0.7; } .qoo-settings-form .qoo-note code { background: var(--qoo-surface); padding: 2px 4px; border-radius: 3px; }
                .qoo-settings-form .qoo-toggle { display: flex; align-items: center; margin-top: 15px; } .qoo-settings-form .qoo-toggle span { margin-left: 10px; }
                .qoo-custom-theme-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; background: var(--qoo-surface); padding: 10px; border-radius: 4px; margin-top: 5px; }
                .qoo-custom-theme-fields div { display: flex; flex-direction: column; } .qoo-custom-theme-fields input[type="color"] { width: 100%; height: 30px; padding: 0; border: none; background: none; }
                .qoo-keybinding-container { display: flex; align-items: center; gap: 10px; }
                .qoo-keybinding-display { flex: 1; padding: 8px 12px; border: 1px solid var(--qoo-surface); border-radius: 4px; background: var(--qoo-surface); font-family: monospace; font-weight: bold; text-align: center; min-height: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
                .qoo-keybinding-display.qoo-recording { background: #FFA500; color: #000; border-color: #FF8C00; animation: qoo-pulse 1s infinite; }
                .qoo-keybinding-display.qoo-success { background: #34A853; color: #fff; border-color: #2d8f47; }
                .qoo-record-btn { padding: 6px 12px; border: 1px solid var(--qoo-primary); background: transparent; color: var(--qoo-primary); border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap; transition: all 0.2s ease; }
                .qoo-record-btn:hover:not(:disabled) { background: var(--qoo-primary); color: var(--qoo-bg); }
                .qoo-record-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                @keyframes qoo-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                .qoo-gmail-preview { width: min(40vw, 400px) !important; max-height: 60vh !important; bottom: 20px !important; right: 20px !important; top: auto !important; left: auto !important; transform: none !important; }
                .qoo-gmail-preview .qoo-content { max-height: 50vh; overflow-y: auto; font-size: 0.9em; }
                .qoo-gmail-preview .qoo-preview-header { padding: 8px 12px !important; }
                .qoo-gmail-preview .qoo-preview-header h3 { font-size: 1em !important; }
                .qoo-preview-controls { display: flex; gap: 5px; }
                .qoo-minimize-btn { font-size: 1.2em; line-height: 1; border: none; background: transparent; cursor: pointer; color: var(--qoo-text); opacity: 0.7; padding: 0 5px; }
                .qoo-minimize-btn:hover { opacity: 1; }
                .qoo-gmail-preview.minimized { height: 40px !important; overflow: hidden; }
                .qoo-gmail-preview.minimized .qoo-content { display: none; }
                .qoo-gmail-preview-content { font-family: inherit; }
                .qoo-gmail-preview-content * { max-width: 100% !important; word-wrap: break-word; }
            `); }
        },

        async handleGlobalClick(event) {
            const target = event.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const panel = target.closest('.qoo-panel');

            switch (action) {
                case 'close-panel':
                    this.UI.closeActivePanel();
                    break;
                case 'close-preview':
                    // Close preview panel specifically
                    if (panel) {
                        panel.remove();
                    }
                    break;
                case 'minimize-preview':
                    // Toggle minimized state for preview
                    if (panel) {
                        panel.classList.toggle('minimized');
                        const minimizeBtn = panel.querySelector('.qoo-minimize-btn');
                        if (minimizeBtn) {
                            minimizeBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
                            minimizeBtn.title = panel.classList.contains('minimized') ? 'Restore' : 'Minimize';
                        }
                    }
                    break;
                case 'record-keybinding':
                    this.UI.startKeybindingRecording();
                    break;
                case 'save-settings':
                    this.UI.showStatus('Saving...', 'working');
                    await GM_setValue(Config.KEYS.urlTemplate, panel.querySelector('#qoo-url-template').value);
                    
                    // Get keybinding from the display element instead of input
                    const keybindingDisplay = panel.querySelector('#qoo-keybinding-display');
                    const newKeybinding = keybindingDisplay ? keybindingDisplay.dataset.keybinding : Config.DEFAULTS.keybinding;
                    await GM_setValue(Config.KEYS.keybinding, newKeybinding);
                    
                    const newTheme = panel.querySelector('#qoo-theme').value;
                    await GM_setValue(Config.KEYS.theme, newTheme);
                    await GM_setValue(Config.KEYS.panelPosition, panel.querySelector('#qoo-panel-position').value);
                    await GM_setValue(Config.KEYS.enableGmailPreview, panel.querySelector('#qoo-gmail-preview').checked);
                    if (newTheme === 'custom') {
                        const customTheme = {};
                        Object.keys(Config.DEFAULTS.customTheme).forEach(key => {
                            customTheme[key] = panel.querySelector(`#qoo-custom-${key}`).value;
                        });
                        await GM_setValue(Config.KEYS.customTheme, customTheme);
                    }
                    this.UI.showStatus('Settings Saved!', 'success');
                    this.UI.closeActivePanel();
                    await this.applyTheme();
                    break;
            }
        },

        async setupEventListeners() {
            const keybinding = await GM_getValue(Config.KEYS.keybinding, Config.DEFAULTS.keybinding);
            document.addEventListener('keydown', (event) => {
                if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
                
                const keys = keybinding.split('+');
                const keyCode = keys.pop(); // This will be a key code like 'KeyO', not a character
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
                    Core.handleActivation();
                }
            }, true);
            document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        },

        async applyTheme() {
            const theme = await GM_getValue(Config.KEYS.theme, Config.DEFAULTS.theme);
            document.body.dataset.qooTheme = theme;
            if (theme === 'custom') {
                const customTheme = await GM_getValue(Config.KEYS.customTheme, Config.DEFAULTS.customTheme);
                let customStyle = ':root {';
                Object.entries(customTheme).forEach(([k, v]) => {
                    customStyle += `--qoo-${k.replace(/_/g, '-')}: ${v};`;
                });
                customStyle += '}';
                // Remove old custom style if it exists
                const oldStyle = document.getElementById('qoo-custom-style');
                if (oldStyle) oldStyle.remove();
                // Add new one
                const styleEl = this.UI.buildElement('style', { textContent: customStyle, attributes: { id: 'qoo-custom-style' } });
                document.head.appendChild(styleEl);
            }
        },

        async initialize() {
            Logger.log('Initializing...');
            await this.migrateOldKeybindings();
            this.UI.injectStyles();
            await this.applyTheme();
            this.setupEventListeners();
            await this.UI.displayGmailPreviewPanel();
            Logger.log('Initialization complete.');
        },

        async migrateOldKeybindings() {
            // Migrate old character-based keybindings to key codes for layout independence
            const currentKeybinding = await GM_getValue(Config.KEYS.keybinding, null);
            
            if (currentKeybinding && !currentKeybinding.includes('Key') && !currentKeybinding.includes('Digit') && !currentKeybinding.includes('F')) {
                // This looks like an old keybinding format, let's try to migrate it
                const parts = currentKeybinding.split('+');
                const lastKey = parts[parts.length - 1];
                
                // Map common characters to key codes
                const charToKeyCode = {
                    'a': 'KeyA', 'b': 'KeyB', 'c': 'KeyC', 'd': 'KeyD', 'e': 'KeyE', 'f': 'KeyF',
                    'g': 'KeyG', 'h': 'KeyH', 'i': 'KeyI', 'j': 'KeyJ', 'k': 'KeyK', 'l': 'KeyL',
                    'm': 'KeyM', 'n': 'KeyN', 'o': 'KeyO', 'p': 'KeyP', 'q': 'KeyQ', 'r': 'KeyR',
                    's': 'KeyS', 't': 'KeyT', 'u': 'KeyU', 'v': 'KeyV', 'w': 'KeyW', 'x': 'KeyX',
                    'y': 'KeyY', 'z': 'KeyZ',
                    '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '4': 'Digit4',
                    '5': 'Digit5', '6': 'Digit6', '7': 'Digit7', '8': 'Digit8', '9': 'Digit9'
                };
                
                const keyCode = charToKeyCode[lastKey.toLowerCase()];
                if (keyCode) {
                    const newKeybinding = parts.slice(0, -1).concat(keyCode).join('+');
                    await GM_setValue(Config.KEYS.keybinding, newKeybinding);
                    Logger.log(`Migrated keybinding from ${currentKeybinding} to ${newKeybinding} for layout independence`);
                }
            }
        }
    };

    // --- SCRIPT ENTRY POINT ---
    GM_registerMenuCommand('Configure Settings', async () => {
        try {
            Logger.log('Settings menu clicked');
            await App.UI.createSettingsPanel();
        } catch (error) {
            Logger.error('Error opening settings panel:', error);
            console.error('Settings panel error:', error);
            // Fallback: create a simple alert-style panel
            const simplePanel = document.createElement('div');
            simplePanel.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                           background: white; border: 2px solid #333; padding: 20px; z-index: 10000;
                           box-shadow: 0 0 20px rgba(0,0,0,0.5); border-radius: 8px;">
                    <h3>Settings Panel Error</h3>
                    <p>There was an error creating the settings panel. Check the console for details.</p>
                    <button onclick="this.closest('div').remove()">Close</button>
                </div>
            `;
            document.body.appendChild(simplePanel);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.initialize());
    } else {
        App.initialize();
    }
})();