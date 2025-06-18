// ==UserScript==
// @name         Drag & Drop File Enhancer
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.5
// @description  Adds beautiful drag and drop functionality to all file upload fields. Enhanced buttons now follow drop zone dimensions.
// @author       Heorhii Litovskyi (George)
// @match        https://essaycock.com/support/dashboard/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/drag-drop-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/drag-drop-enhancer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // =================================================================================
    // --- MODULE 1: CONFIGURATION & CONSTANTS ---
    // =================================================================================
    const Config = {
        SCRIPT_NAME: 'Drag & Drop File Enhancer',
        LOG_PREFIX: '[DDFE]',
        DEFAULTS: {
            enabled: true,
            theme: 'modern-blue',
            showAnimations: true,
            autoActivate: true,
            maxFileSize: 100, // MB
            leftExtension: 300, // px - how much to extend the drop zone to the left
            buttonFollowZone: false, // Make buttons match drop zone width
            customTheme: {
                primaryColor: '#007bff',
                secondaryColor: '#6c757d',
                successColor: '#28a745',
                warningColor: '#ffc107',
                dangerColor: '#dc3545',
                backgroundColor: '#f8f9fa',
                borderColor: '#dee2e6'
            }
        },
        STORAGE_KEYS: {
            settings: 'ddfe_settings_v1'
        },
        FILE_INPUT_SELECTORS: [
            'input[type="file"]',
            '.fileinput-button input[type="file"]',
            '.file-upload input[type="file"]',
            '.upload-button input[type="file"]'
        ]
    };

    const Logger = {
        log: (message, ...args) => console.log(`${Config.LOG_PREFIX} ${message}`, ...args),
        warn: (message, ...args) => console.warn(`${Config.LOG_PREFIX} ${message}`, ...args),
        error: (message, ...args) => console.error(`${Config.LOG_PREFIX} ${message}`, ...args),
    };

    // =================================================================================
    // --- MODULE 2: SETTINGS MANAGEMENT ---
    // =================================================================================
    let settings = {};

    const Settings = {
        async load() {
            const stored = await GM_getValue(Config.STORAGE_KEYS.settings, Config.DEFAULTS);
            settings = { ...Config.DEFAULTS, ...stored };
            settings.customTheme = { ...Config.DEFAULTS.customTheme, ...(stored.customTheme || {}) };
            Logger.log('Settings loaded:', settings);
        },

        async save() {
            await GM_setValue(Config.STORAGE_KEYS.settings, settings);
            Logger.log('Settings saved');
        },

        get(key) {
            return settings[key];
        },

        set(key, value) {
            settings[key] = value;
            this.save();
        }
    };

    // =================================================================================
    // --- MODULE 3: STYLES & THEMES ---
    // =================================================================================
    const Styles = {
        inject() {
            GM_addStyle(`
                /* Base Styles for Drag & Drop Zones */
                .ddfe-drop-zone {
                    position: relative;
                    min-height: 60px;
                    border: 2px dashed var(--ddfe-border-color, #dee2e6);
                    border-radius: 8px;
                    background: var(--ddfe-bg-color, #f8f9fa);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 12px 8px;
                    margin: 4px 0;
                    cursor: pointer;
                    user-select: none;
                    box-sizing: border-box;
                    width: 100%;
                    overflow: visible;
                    contain: layout style;
                    flex-shrink: 1;
                    z-index: 10;
                }

                .ddfe-drop-zone:hover {
                    border-color: var(--ddfe-primary-color, #007bff);
                    background: var(--ddfe-hover-bg, rgba(0, 123, 255, 0.03));
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
                }

                .ddfe-drop-zone.ddfe-drag-over {
                    border-color: var(--ddfe-success-color, #28a745);
                    background: var(--ddfe-success-bg, rgba(40, 167, 69, 0.05));
                    animation: ddfe-pulse 2s infinite;
                    border-style: solid;
                }

                .ddfe-drop-zone.ddfe-error {
                    border-color: var(--ddfe-danger-color, #dc3545);
                    background: var(--ddfe-error-bg, rgba(220, 53, 69, 0.05));
                    animation: ddfe-shake 0.4s ease-in-out;
                }

                .ddfe-drop-zone.ddfe-success {
                    border-color: var(--ddfe-success-color, #28a745);
                    background: var(--ddfe-success-bg, rgba(40, 167, 69, 0.05));
                    animation: ddfe-success-flash 0.5s ease-out;
                }

                .ddfe-drop-zone.ddfe-uploading {
                    border-color: var(--ddfe-warning-color, #ffc107);
                    background: var(--ddfe-warning-bg, rgba(255, 193, 7, 0.05));
                    cursor: default;
                    pointer-events: none;
                }

                .ddfe-content {
                    text-align: center;
                    pointer-events: none;
                    width: 100%;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-width: 0;
                    flex-shrink: 1;
                }

                .ddfe-icon {
                    font-size: 1.8rem;
                    color: var(--ddfe-secondary-color, #6c757d);
                    margin-bottom: 8px;
                    transition: all 0.3s ease;
                    line-height: 1;
                }

                .ddfe-drop-zone:hover .ddfe-icon {
                    color: var(--ddfe-primary-color, #007bff);
                    transform: scale(1.05);
                }

                .ddfe-text {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--ddfe-text-color, #495057);
                    margin-bottom: 2px;
                    line-height: 1.3;
                    word-wrap: break-word;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 100%;
                }

                .ddfe-subtext {
                    font-size: 11px;
                    color: var(--ddfe-secondary-color, #6c757d);
                    margin-bottom: 6px;
                    line-height: 1.2;
                    word-wrap: break-word;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ddfe-file-info {
                    display: none;
                    padding: 6px 12px;
                    background: var(--ddfe-info-bg, rgba(0, 123, 255, 0.1));
                    border-radius: 12px;
                    font-size: 11px;
                    color: var(--ddfe-primary-color, #007bff);
                    font-weight: 500;
                    overflow: visible;
                    white-space: normal;
                    word-wrap: break-word;
                    text-align: center;
                    line-height: 1.3;
                    margin: 4px 0 0 0;
                    position: relative;
                    z-index: 5;
                }

                .ddfe-progress-container {
                    display: none;
                    width: 100%;
                    margin-top: 12px;
                    padding: 0 4px;
                    box-sizing: border-box;
                }

                .ddfe-progress-bar {
                    width: 100%;
                    height: 6px;
                    background: var(--ddfe-border-color, #dee2e6);
                    border-radius: 3px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
                }

                .ddfe-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--ddfe-primary-color, #007bff), var(--ddfe-success-color, #28a745));
                    border-radius: 3px;
                    width: 0%;
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }

                .ddfe-progress-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    animation: ddfe-progress-shine 2s infinite ease-in-out;
                    opacity: 0;
                }

                .ddfe-progress-fill.ddfe-active::after {
                    opacity: 1;
                }

                @keyframes ddfe-progress-shine {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .ddfe-progress-text {
                    font-size: 11px;
                    color: var(--ddfe-secondary-color, #6c757d);
                    margin-top: 6px;
                    text-align: center;
                    font-weight: 500;
                    line-height: 1.2;
                }

                .ddfe-hidden-input {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 2;
                    top: 0;
                    left: 0;
                    border: none;
                    outline: none;
                    background: transparent;
                }

                /* Compact mode for small spaces */
                .ddfe-drop-zone.ddfe-compact {
                    min-height: 32px;
                    padding: 6px 8px;
                    flex-direction: row;
                    text-align: left;
                }

                .ddfe-compact .ddfe-content {
                    flex-direction: row;
                    align-items: center;
                    display: flex;
                    text-align: left;
                    justify-content: flex-start;
                }

                .ddfe-compact .ddfe-icon {
                    font-size: 1rem;
                    margin-bottom: 0;
                    margin-right: 6px;
                    flex-shrink: 0;
                }

                .ddfe-compact .ddfe-text {
                    font-size: 11px;
                    margin-bottom: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .ddfe-compact .ddfe-subtext {
                    display: none;
                }

                .ddfe-compact .ddfe-file-info {
                    font-size: 10px;
                    margin: 2px 0 0 0;
                    padding: 4px 8px;
                }

                .ddfe-compact .ddfe-progress-container {
                    margin-top: 4px;
                    position: absolute;
                    bottom: 2px;
                    left: 8px;
                    right: 8px;
                    width: auto;
                }

                .ddfe-compact .ddfe-progress-bar {
                    height: 2px;
                }

                .ddfe-compact .ddfe-progress-text {
                    display: none;
                }

                /* Original Button Enhancement */
                .ddfe-enhanced-button {
                    position: relative;
                    overflow: visible !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .ddfe-enhanced-button::after {
                    content: '⤴';
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: var(--ddfe-success-color, #28a745);
                    color: white;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: bold;
                    animation: ddfe-bounce 2s infinite;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    line-height: 1;
                }

                .ddfe-enhanced-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
                }

                /* Optional: Button width matching for dimension synchronization */
                .ddfe-enhanced-button.ddfe-match-zone-width {
                    width: 100%;
                    display: block;
                    box-sizing: border-box;
                }

                /* Theme Styles */
                .ddfe-theme-modern-blue {
                    --ddfe-primary-color: #007bff;
                    --ddfe-secondary-color: #6c757d;
                    --ddfe-success-color: #28a745;
                    --ddfe-warning-color: #ffc107;
                    --ddfe-danger-color: #dc3545;
                    --ddfe-bg-color: #f8f9fa;
                    --ddfe-border-color: #dee2e6;
                    --ddfe-text-color: #495057;
                    --ddfe-hover-bg: rgba(0, 123, 255, 0.05);
                    --ddfe-success-bg: rgba(40, 167, 69, 0.1);
                    --ddfe-error-bg: rgba(220, 53, 69, 0.1);
                    --ddfe-info-bg: rgba(0, 123, 255, 0.1);
                }

                .ddfe-theme-dark {
                    --ddfe-primary-color: #0d6efd;
                    --ddfe-secondary-color: #adb5bd;
                    --ddfe-success-color: #198754;
                    --ddfe-warning-color: #ffc107;
                    --ddfe-danger-color: #dc3545;
                    --ddfe-bg-color: #212529;
                    --ddfe-border-color: #495057;
                    --ddfe-text-color: #f8f9fa;
                    --ddfe-hover-bg: rgba(13, 110, 253, 0.1);
                    --ddfe-success-bg: rgba(25, 135, 84, 0.2);
                    --ddfe-error-bg: rgba(220, 53, 69, 0.2);
                    --ddfe-info-bg: rgba(13, 110, 253, 0.2);
                }

                .ddfe-theme-green {
                    --ddfe-primary-color: #28a745;
                    --ddfe-secondary-color: #6c757d;
                    --ddfe-success-color: #20c997;
                    --ddfe-warning-color: #ffc107;
                    --ddfe-danger-color: #dc3545;
                    --ddfe-bg-color: #f8fff9;
                    --ddfe-border-color: #c3e6cb;
                    --ddfe-text-color: #155724;
                    --ddfe-hover-bg: rgba(40, 167, 69, 0.05);
                    --ddfe-success-bg: rgba(32, 201, 151, 0.1);
                    --ddfe-error-bg: rgba(220, 53, 69, 0.1);
                    --ddfe-info-bg: rgba(40, 167, 69, 0.1);
                }

                /* Animations */
                @keyframes ddfe-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }

                @keyframes ddfe-shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                @keyframes ddfe-success-flash {
                    0% { background: var(--ddfe-success-bg); }
                    50% { background: var(--ddfe-success-color); }
                    100% { background: var(--ddfe-success-bg); }
                }

                @keyframes ddfe-bounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }

                /* Settings Panel */
                .ddfe-settings-panel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    padding: 24px;
                    width: 90%;
                    max-width: 500px;
                    z-index: 100000;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .ddfe-settings-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 99999;
                    backdrop-filter: blur(5px);
                }

                .ddfe-settings-group {
                    margin-bottom: 20px;
                }

                .ddfe-settings-label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }

                .ddfe-settings-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }

                .ddfe-settings-checkbox {
                    margin-right: 8px;
                }

                .ddfe-settings-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }

                .ddfe-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ddfe-btn-primary {
                    background: #007bff;
                    color: white;
                }

                .ddfe-btn-primary:hover {
                    background: #0056b3;
                }

                .ddfe-btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .ddfe-btn-secondary:hover {
                    background: #545b62;
                }

                /* Container constraints */
                .ddfe-drop-zone {
                    max-height: 200px;
                    overflow: visible;
                }

                /* Ensure drop zones fit within their containers */
                .ddfe-drop-zone.ddfe-constrained {
                    padding: 8px 6px;
                    overflow: visible;
                }

                /* Ultra compact mode for very small containers */
                .ddfe-drop-zone.ddfe-micro {
                    min-height: 24px;
                    padding: 4px 6px;
                    border-width: 1px;
                }

                .ddfe-micro .ddfe-content {
                    flex-direction: row;
                    justify-content: flex-start;
                }

                .ddfe-micro .ddfe-icon {
                    font-size: 0.8rem;
                    margin-right: 4px;
                    margin-bottom: 0;
                }

                .ddfe-micro .ddfe-text {
                    font-size: 10px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100px;
                }

                .ddfe-micro .ddfe-subtext,
                .ddfe-micro .ddfe-file-info,
                .ddfe-micro .ddfe-progress-container {
                    display: none;
                }

                /* Prevent file info from causing horizontal overflow */
                .ddfe-file-info {
                    box-sizing: border-box;
                }

                .ddfe-micro .ddfe-file-info {
                    display: none !important;
                }

                /* Improved compact mode */
                .ddfe-compact {
                    min-height: 32px !important;
                    padding: 6px 8px !important;
                }

                .ddfe-compact .ddfe-progress-container {
                    margin-top: 6px;
                }

                .ddfe-compact .ddfe-progress-bar {
                    height: 3px;
                }

                /* Disable animations for users who prefer reduced motion */
                @media (prefers-reduced-motion: reduce) {
                    .ddfe-drop-zone,
                    .ddfe-icon,
                    .ddfe-enhanced-button::after {
                        animation: none !important;
                        transition: none !important;
                    }
                }
            `);
        },

        applyTheme(theme) {
            document.body.classList.remove('ddfe-theme-modern-blue', 'ddfe-theme-dark', 'ddfe-theme-green', 'ddfe-theme-custom');

            if (theme === 'custom') {
                this.applyCustomTheme();
            }

            document.body.classList.add(`ddfe-theme-${theme}`);
            
            // Apply left extension setting
            this.applyLeftExtension();
        },

        applyLeftExtension() {
            const leftExtension = settings.leftExtension || 300;
            document.documentElement.style.setProperty('--ddfe-left-extension', `-${leftExtension}px`);
        },

        applyCustomTheme() {
            let styleEl = document.getElementById('ddfe-custom-theme');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'ddfe-custom-theme';
                document.head.appendChild(styleEl);
            }

            const colors = settings.customTheme;
            styleEl.textContent = `
                .ddfe-theme-custom {
                    --ddfe-primary-color: ${colors.primaryColor};
                    --ddfe-secondary-color: ${colors.secondaryColor};
                    --ddfe-success-color: ${colors.successColor};
                    --ddfe-warning-color: ${colors.warningColor};
                    --ddfe-danger-color: ${colors.dangerColor};
                    --ddfe-bg-color: ${colors.backgroundColor};
                    --ddfe-border-color: ${colors.borderColor};
                    --ddfe-text-color: #333;
                    --ddfe-hover-bg: ${colors.primaryColor}0D;
                    --ddfe-success-bg: ${colors.successColor}1A;
                    --ddfe-error-bg: ${colors.dangerColor}1A;
                    --ddfe-info-bg: ${colors.primaryColor}1A;
                }
            `;
        }
    };

    // =================================================================================
    // --- MODULE 4: DRAG & DROP FUNCTIONALITY ---
    // =================================================================================
    const DragDrop = {
        enhancedInputs: new Set(),

        initialize() {
            if (!settings.enabled) return;

            Logger.log('Initializing drag & drop enhancement...');
            this.findAndEnhanceFileInputs();
            this.observeForNewInputs();
        },

        findAndEnhanceFileInputs() {
            Config.FILE_INPUT_SELECTORS.forEach(selector => {
                const inputs = document.querySelectorAll(selector);
                inputs.forEach(input => this.enhanceFileInput(input));
            });
        },

        observeForNewInputs() {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                Config.FILE_INPUT_SELECTORS.forEach(selector => {
                                    if (node.matches && node.matches(selector)) {
                                        this.enhanceFileInput(node);
                                    }
                                    const inputs = node.querySelectorAll && node.querySelectorAll(selector);
                                    if (inputs) {
                                        inputs.forEach(input => this.enhanceFileInput(input));
                                    }
                                });
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        enhanceFileInput(input) {
            if (this.enhancedInputs.has(input) || !input || input.type !== 'file') return;

            this.enhancedInputs.add(input);
            Logger.log('Enhancing file input:', input);

            // Create drop zone
            const dropZone = this.createDropZone(input);

            // Insert drop zone
            this.insertDropZone(input, dropZone);

            // Enhance original button
            this.enhanceOriginalButton(input);

            // Setup events
            this.setupDropZoneEvents(dropZone, input);

            // Store reference for cleanup
            input._ddfeDropZone = dropZone;
        },

        createDropZone(input) {
            const dropZone = document.createElement('div');
            dropZone.className = 'ddfe-drop-zone';

            const multiple = input.hasAttribute('multiple');
            const accept = input.getAttribute('accept') || '';

            // Create more compact text for smaller containers
            const mainText = multiple ? 'Drop files or click' : 'Drop file or click';
            const acceptText = accept ? accept.split(',').map(type => type.trim().replace('image/', 'img').replace('application/', '').replace('text/', '')).join(', ') : '';
            const sizeText = settings.maxFileSize ? `Max: ${settings.maxFileSize}MB` : '';

            let subText = '';
            if (acceptText && sizeText) {
                subText = `${acceptText} • ${sizeText}`;
            } else if (acceptText) {
                subText = acceptText;
            } else if (sizeText) {
                subText = sizeText;
            } else {
                subText = 'Any file type';
            }

            dropZone.innerHTML = `
                <div class="ddfe-content">
                    <div class="ddfe-icon">📁</div>
                    <div class="ddfe-text">${mainText}</div>
                    <div class="ddfe-subtext">${subText}</div>
                    <div class="ddfe-file-info"></div>
                    <div class="ddfe-progress-container">
                        <div class="ddfe-progress-bar">
                            <div class="ddfe-progress-fill"></div>
                        </div>
                        <div class="ddfe-progress-text">Uploading...</div>
                    </div>
                </div>
                <input type="file" class="ddfe-hidden-input" ${multiple ? 'multiple' : ''} ${accept ? `accept="${accept}"` : ''}>
            `;

            return dropZone;
        },

        insertDropZone(originalInput, dropZone) {
            // Try to find the best place to insert the drop zone
            const parent = originalInput.closest('.fileinput-button') ||
                          originalInput.closest('.file-upload') ||
                          originalInput.closest('.upload-button') ||
                          originalInput.closest('.form-group') ||
                          originalInput.closest('form') ||
                          originalInput.parentElement;

            // Ensure container can hold the drop zone properly
            if (parent) {
                // Add positioning context if needed
                const computedStyle = window.getComputedStyle(parent);
                if (computedStyle.position === 'static') {
                    parent.style.position = 'relative';
                }

                // Insert the drop zone
                if (originalInput.nextSibling) {
                    parent.insertBefore(dropZone, originalInput.nextSibling);
                } else {
                    parent.appendChild(dropZone);
                }
            } else {
                // Fallback: insert after original input
                originalInput.parentNode.insertBefore(dropZone, originalInput.nextSibling);
            }
        },

        enhanceOriginalButton(input) {
            const button = input.closest('.fileinput-button') ||
                          input.closest('.btn') ||
                          input.closest('.file-input-wrapper') ||
                          input.parentElement;

            if (button && button.tagName !== 'INPUT' && !button.classList.contains('ddfe-enhanced-button')) {
                button.classList.add('ddfe-enhanced-button');
                
                // Ensure the button container has proper positioning
                const computedStyle = window.getComputedStyle(button);
                if (computedStyle.position === 'static') {
                    button.style.position = 'relative';
                }

                // Optional: Make button match drop zone width if enabled
                if (settings.buttonFollowZone) {
                    button.classList.add('ddfe-match-zone-width');
                }
            }
        },

        setupDropZoneEvents(dropZone, originalInput) {
            const hiddenInput = dropZone.querySelector('.ddfe-hidden-input');
            const fileInfo = dropZone.querySelector('.ddfe-file-info');

            // Click to browse
            dropZone.addEventListener('click', (e) => {
                if (e.target === dropZone || e.target.closest('.ddfe-content')) {
                    hiddenInput.click();
                }
            });

            // File selection via hidden input
            hiddenInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files, originalInput, dropZone);
            });

            // Drag and drop events
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, this.preventDefaults, false);
            });

            dropZone.addEventListener('dragenter', () => {
                dropZone.classList.add('ddfe-drag-over');
            });

            dropZone.addEventListener('dragleave', (e) => {
                if (!dropZone.contains(e.relatedTarget)) {
                    dropZone.classList.remove('ddfe-drag-over');
                }
            });

            dropZone.addEventListener('drop', (e) => {
                dropZone.classList.remove('ddfe-drag-over');
                const files = e.dataTransfer.files;
                this.handleFileSelection(files, originalInput, dropZone);
            });

            // Monitor for actual form submissions to show real upload progress
            this.monitorFormSubmission(originalInput, dropZone);
        },

        monitorFormSubmission(originalInput, dropZone) {
            const form = originalInput.closest('form');
            if (!form) return;

            // Store reference for cleanup
            if (!form._ddfeMonitored) {
                form._ddfeMonitored = true;

                const originalSubmit = form.submit;
                form.submit = function() {
                    DragDrop.handleFormSubmission(form, dropZone);
                    return originalSubmit.apply(this, arguments);
                };

                form.addEventListener('submit', (e) => {
                    // Only show progress if files are actually selected
                    if (originalInput.files && originalInput.files.length > 0) {
                        DragDrop.showRealUploadProgress(dropZone, originalInput.files);
                    }
                });
            }
        },

        handleFormSubmission(form, dropZone) {
            // This could be enhanced to hook into XMLHttpRequest or fetch for real progress
            Logger.log('Form submission detected, monitoring upload...');
        },

        showRealUploadProgress(dropZone, files) {
            const progressContainer = dropZone.querySelector('.ddfe-progress-container');
            const progressFill = dropZone.querySelector('.ddfe-progress-fill');
            const progressText = dropZone.querySelector('.ddfe-progress-text');

            if (!progressContainer) return;

            // Show real upload progress UI
            progressContainer.style.display = 'block';
            progressFill.classList.add('ddfe-active');
            dropZone.classList.add('ddfe-uploading');

            const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);

            progressText.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''} (${totalSizeMB}MB)...`;

            // Start indeterminate progress since we can't easily hook into real upload progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 5 + 2;
                if (progress >= 95) {
                    progress = 95; // Stop at 95% until we know it's complete
                }
                progressFill.style.width = `${progress}%`;
            }, 200);

            // Clean up after a reasonable time (fallback)
            setTimeout(() => {
                clearInterval(interval);
                progressFill.style.width = '100%';
                progressText.textContent = 'Upload complete!';

                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    dropZone.classList.remove('ddfe-uploading');
                    progressFill.classList.remove('ddfe-active');
                    progressFill.style.width = '0%';
                }, 2000);
            }, 8000);
        },

        preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        },

        handleFileSelection(files, originalInput, dropZone) {
            if (!files.length) return;

            const fileInfo = dropZone.querySelector('.ddfe-file-info');
            const progressContainer = dropZone.querySelector('.ddfe-progress-container');
            const progressFill = dropZone.querySelector('.ddfe-progress-fill');
            const progressText = dropZone.querySelector('.ddfe-progress-text');

            // Validate files
            const validFiles = this.validateFiles(files);

            if (validFiles.length === 0) {
                this.showError(dropZone, 'No valid files selected');
                return;
            }

            // Show upload progress
            this.showUploadProgress(dropZone, validFiles, () => {
                // Create new FileList and transfer to original input
                const dt = new DataTransfer();
                validFiles.forEach(file => dt.items.add(file));
                originalInput.files = dt.files;

                // Trigger change event on original input
                originalInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Show success feedback
                this.showSuccess(dropZone, validFiles);

                // Update file info
                const fileNames = this.formatFileNames(validFiles);
                fileInfo.textContent = `Selected: ${fileNames}`;
                fileInfo.style.display = 'block';

                // Add tooltip for very long filenames
                if (fileNames.length > 50) {
                    const fullNames = validFiles.map(f => f.name).join(', ');
                    fileInfo.title = `Selected: ${fullNames}`;
                }

                // Hide progress after success
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1500);

                Logger.log('Files transferred to original input:', validFiles);
            });
        },

        showUploadProgress(dropZone, files, onComplete) {
            const progressContainer = dropZone.querySelector('.ddfe-progress-container');
            const progressFill = dropZone.querySelector('.ddfe-progress-fill');
            const progressText = dropZone.querySelector('.ddfe-progress-text');

            // Show progress UI
            progressContainer.style.display = 'block';
            progressFill.classList.add('ddfe-active');
            dropZone.classList.add('ddfe-uploading');

            let progress = 0;
            const totalSize = files.reduce((total, file) => total + file.size, 0);
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);

            // Simulate upload progress
            const updateProgress = () => {
                if (progress >= 100) {
                    progressFill.style.width = '100%';
                    progressText.textContent = 'Upload complete!';
                    dropZone.classList.remove('ddfe-uploading');
                    progressFill.classList.remove('ddfe-active');

                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 500);
                    return;
                }

                // Simulate realistic upload speed (faster for smaller files)
                const increment = Math.max(2, Math.min(8, 100 / (totalSize / (1024 * 100))));
                progress += increment + Math.random() * 2;
                progress = Math.min(progress, 100);

                progressFill.style.width = `${progress}%`;

                if (files.length === 1) {
                    progressText.textContent = `Uploading ${files[0].name}... ${Math.round(progress)}%`;
                } else {
                    progressText.textContent = `Uploading ${files.length} files (${totalSizeMB}MB)... ${Math.round(progress)}%`;
                }

                // More realistic timing based on file size
                const delay = Math.max(50, Math.min(200, totalSize / (1024 * 50)));
                setTimeout(updateProgress, delay);
            };

            // Start progress animation
            setTimeout(updateProgress, 100);
        },

        formatFileNames(files) {
            if (files.length === 0) return '';
            
            if (files.length === 1) {
                const name = files[0].name;
                // For single files, allow longer names but still truncate extremely long ones
                return name.length > 60 ? name.substring(0, 57) + '...' : name;
            }
            
            // For multiple files, show first few names with counts
            if (files.length <= 3) {
                const names = files.map(f => {
                    const name = f.name;
                    return name.length > 25 ? name.substring(0, 22) + '...' : name;
                });
                return names.join(', ');
            } else {
                // Show first 2 files and count
                const firstTwo = files.slice(0, 2).map(f => {
                    const name = f.name;
                    return name.length > 20 ? name.substring(0, 17) + '...' : name;
                });
                return `${firstTwo.join(', ')} and ${files.length - 2} more`;
            }
        },

        validateFiles(files) {
            const validFiles = [];
            const maxSize = settings.maxFileSize * 1024 * 1024; // Convert MB to bytes

            Array.from(files).forEach(file => {
                if (maxSize && file.size > maxSize) {
                    Logger.warn(`File ${file.name} exceeds size limit`);
                    return;
                }
                validFiles.push(file);
            });

            return validFiles;
        },

        showSuccess(dropZone, files) {
            if (!settings.showAnimations) return;

            dropZone.classList.add('ddfe-success');
            setTimeout(() => dropZone.classList.remove('ddfe-success'), 600);
        },

        showError(dropZone, message) {
            if (!settings.showAnimations) return;

            dropZone.classList.add('ddfe-error');
            setTimeout(() => dropZone.classList.remove('ddfe-error'), 500);
            Logger.warn(message);
        },

        cleanup() {
            // Clean up all enhanced inputs
            this.enhancedInputs.forEach(input => {
                const dropZone = input._ddfeDropZone;
                if (dropZone) {
                    // Remove drop zone from DOM
                    if (dropZone.parentNode) {
                        dropZone.parentNode.removeChild(dropZone);
                    }

                    delete input._ddfeDropZone;
                }
                
                // Clean up enhanced buttons
                const button = input.closest('.ddfe-enhanced-button');
                if (button) {
                    button.classList.remove('ddfe-enhanced-button');
                }
            });

            this.enhancedInputs.clear();
        },
    };

    // =================================================================================
    // --- MODULE 5: SETTINGS UI ---
    // =================================================================================
    const SettingsUI = {
        isOpen: false,

        show() {
            if (this.isOpen) return;
            this.isOpen = true;

            const overlay = document.createElement('div');
            overlay.className = 'ddfe-settings-overlay';

            const panel = document.createElement('div');
            panel.className = 'ddfe-settings-panel';
            panel.innerHTML = this.createSettingsHTML();

            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            this.bindEvents(overlay, panel);
            this.loadCurrentSettings(panel);
        },

        createSettingsHTML() {
            return `
                <h2 style="margin: 0 0 20px 0; color: #333;">Drag & Drop Settings</h2>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">
                        <input type="checkbox" class="ddfe-settings-checkbox" data-setting="enabled">
                        Enable Drag & Drop Enhancement
                    </label>
                </div>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">Theme</label>
                    <select class="ddfe-settings-input" data-setting="theme">
                        <option value="modern-blue">Modern Blue</option>
                        <option value="dark">Dark</option>
                        <option value="green">Green</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">
                        <input type="checkbox" class="ddfe-settings-checkbox" data-setting="showAnimations">
                        Show Animations
                    </label>
                </div>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">Max File Size (MB)</label>
                    <input type="number" class="ddfe-settings-input" data-setting="maxFileSize" min="1" max="1000">
                </div>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">Left Extension (px)</label>
                    <input type="number" class="ddfe-settings-input" data-setting="leftExtension" min="0" max="1000" step="10">
                    <small style="color: #6c757d; font-size: 12px; display: block; margin-top: 4px;">
                        How much the drop zone extends to the left (default: 300px)
                    </small>
                </div>

                <div class="ddfe-settings-group">
                    <label class="ddfe-settings-label">
                        <input type="checkbox" class="ddfe-settings-checkbox" data-setting="buttonFollowZone">
                        Buttons Follow Drop Zone Width
                    </label>
                    <small style="color: #6c757d; font-size: 12px; display: block; margin-top: 4px;">
                        Makes upload buttons match the width of their drop zones
                    </small>
                </div>

                <div class="ddfe-settings-group" id="custom-theme-section" style="display: none;">
                    <h3 style="margin: 0 0 12px 0; color: #333;">Custom Theme Colors</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label class="ddfe-settings-label">Primary Color</label>
                            <input type="color" class="ddfe-settings-input" data-setting="customTheme.primaryColor">
                        </div>
                        <div>
                            <label class="ddfe-settings-label">Success Color</label>
                            <input type="color" class="ddfe-settings-input" data-setting="customTheme.successColor">
                        </div>
                        <div>
                            <label class="ddfe-settings-label">Background Color</label>
                            <input type="color" class="ddfe-settings-input" data-setting="customTheme.backgroundColor">
                        </div>
                        <div>
                            <label class="ddfe-settings-label">Border Color</label>
                            <input type="color" class="ddfe-settings-input" data-setting="customTheme.borderColor">
                        </div>
                    </div>
                </div>

                <div class="ddfe-settings-buttons">
                    <button class="ddfe-btn ddfe-btn-secondary" data-action="cancel">Cancel</button>
                    <button class="ddfe-btn ddfe-btn-primary" data-action="save">Save & Apply</button>
                </div>
            `;
        },

        bindEvents(overlay, panel) {
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });

            // Button actions
            panel.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'cancel') this.close();
                if (action === 'save') this.save(panel);
            });

            // Theme change
            const themeSelect = panel.querySelector('[data-setting="theme"]');
            themeSelect.addEventListener('change', (e) => {
                const customSection = panel.querySelector('#custom-theme-section');
                customSection.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        },

        loadCurrentSettings(panel) {
            Object.keys(settings).forEach(key => {
                const input = panel.querySelector(`[data-setting="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = settings[key];
                    } else {
                        input.value = settings[key];
                    }
                }
            });

            // Load custom theme colors
            Object.keys(settings.customTheme).forEach(key => {
                const input = panel.querySelector(`[data-setting="customTheme.${key}"]`);
                if (input) {
                    input.value = settings.customTheme[key];
                }
            });

            // Show/hide custom theme section
            const customSection = panel.querySelector('#custom-theme-section');
            customSection.style.display = settings.theme === 'custom' ? 'block' : 'none';
        },

        save(panel) {
            const newSettings = { ...settings };

            // Save basic settings
            panel.querySelectorAll('[data-setting]:not([data-setting*="."])').forEach(input => {
                const key = input.dataset.setting;
                if (input.type === 'checkbox') {
                    newSettings[key] = input.checked;
                } else if (input.type === 'number') {
                    newSettings[key] = parseInt(input.value);
                } else {
                    newSettings[key] = input.value;
                }
            });

            // Save custom theme colors
            panel.querySelectorAll('[data-setting*="customTheme."]').forEach(input => {
                const key = input.dataset.setting.split('.')[1];
                newSettings.customTheme[key] = input.value;
            });

            // Apply new settings
            Object.assign(settings, newSettings);
            Settings.save();

            // Apply theme
            Styles.applyTheme(settings.theme);

            // Update existing buttons if buttonFollowZone setting changed
            this.updateExistingButtons();

            // Reinitialize if enabled status changed
            if (settings.enabled) {
                DragDrop.initialize();
            }

            this.close();
            Logger.log('Settings saved and applied');
        },

        updateExistingButtons() {
            document.querySelectorAll('.ddfe-enhanced-button').forEach(button => {
                if (settings.buttonFollowZone) {
                    button.classList.add('ddfe-match-zone-width');
                } else {
                    button.classList.remove('ddfe-match-zone-width');
                }
            });
        },

        close() {
            const overlay = document.querySelector('.ddfe-settings-overlay');
            if (overlay) {
                overlay.remove();
            }
            this.isOpen = false;
        }
    };

    // =================================================================================
    // --- MODULE 6: MAIN APPLICATION ---
    // =================================================================================
    const App = {
        async initialize() {
            Logger.log('Initializing Drag & Drop File Enhancer...');

            try {
                await Settings.load();
                Styles.inject();
                Styles.applyTheme(settings.theme);

                if (settings.autoActivate) {
                    // Wait for page to be fully loaded
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            setTimeout(() => DragDrop.initialize(), 1000);
                        });
                    } else {
                        setTimeout(() => DragDrop.initialize(), 1000);
                    }
                }

                Logger.log('Drag & Drop File Enhancer initialized successfully');
            } catch (error) {
                Logger.error('Failed to initialize:', error);
            }
        }
    };

    // =================================================================================
    // --- SCRIPT ENTRY POINT ---
    // =================================================================================

    // Register menu command
    GM_registerMenuCommand('Configure Drag & Drop', () => {
        SettingsUI.show();
    });

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', App.initialize);
    } else {
        App.initialize();
    }

})();
