// ==UserScript==
// @name         Floating Calculator (alt + c)
// @namespace    https://github.com/zhotheone/jobscripts
// @version      1.1
// @description  A collapsible, draggable calculator.
// @author       Heorhii Litovskyi (George)
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/zhotheone/jobscripts/main/calculator.js
// @downloadURL  https://raw.githubusercontent.com/zhotheone/jobscripts/main/calculator.js
// ==/UserScript==

(function() {
    'use strict';

    // --- STATE & CONFIGURATION ---
    const STORAGE_KEY = 'floatingCalculatorSettings_v3';
    const DEFAULTS = {
        theme: 'dawn',
        keybinding: 'alt+KeyC',
        position: { top: '100px', left: '100px' },
        isCollapsed: true,
        customColors: {
            '--fc-base': '#faf4ed', '--fc-surface': '#fffaf3', '--fc-overlay': '#f2e9e1', '--fc-muted': '#9893a5', '--fc-subtle': '#797593', '--fc-text': '#575279', '--fc-love': '#b4637a', '--fc-gold': '#ea9d34', '--fc-rose': '#d7827e', '--fc-pine': '#286983', '--fc-foam': '#56949f', '--fc-iris': '#907aa9', '--fc-highlightMed': '#dfdad9',
        }
    };
    const storedState = GM_getValue(STORAGE_KEY, {});
    let state = { ...DEFAULTS, ...storedState, customColors: { ...DEFAULTS.customColors, ...(storedState.customColors || {}) } };

    let calculatorVisible = false;
    let calculatorUI, settingsUI, activeOperatorBtn = null;
    let currentInput = '0', previousInput = '', operator = null, displayNeedsReset = true, lastCalculation = '', isCopying = false;

    // --- STYLES ---
    GM_addStyle(`
        /* --- Theme Variable Definitions (Defaults) --- */
        body.fc-theme-dawn { --fc-base: #faf4ed; --fc-surface: #fffaf3; --fc-overlay: #f2e9e1; --fc-muted: #9893a5; --fc-subtle: #797593; --fc-text: #575279; --fc-love: #b4637a; --fc-gold: #ea9d34; --fc-rose: #d7827e; --fc-pine: #286983; --fc-foam: #56949f; --fc-iris: #907aa9; --fc-highlightMed: #dfdad9; }
        body.fc-theme-moon { --fc-base: #232136; --fc-surface: #2a273f; --fc-overlay: #393552; --fc-muted: #6e6a86; --fc-subtle: #908caa; --fc-text: #e0def4; --fc-love: #eb6f92; --fc-gold: #f6c177; --fc-rose: #ea9a97; --fc-pine: #3e8fb0; --fc-foam: #9ccfd8; --fc-iris: #c4a7e7; --fc-highlightMed: #44415a; }

        /* --- Animation Keyframes --- */
        @keyframes fc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fc-scale-in { from { transform: scale(0.95); } to { transform: scale(1); } }
        @keyframes fc-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes fc-copy-flash { 50% { background-color: var(--fc-foam); color: var(--fc-base); } }

        /* --- Calculator Styles --- */
        #fc-container {
            position: fixed; z-index: 99999; width: 280px; 
            background: linear-gradient(135deg, var(--fc-base) 0%, var(--fc-surface) 100%);
            border: 1px solid var(--fc-highlightMed); border-radius: 16px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            display: none; flex-direction: column;
            opacity: 0; transform: scale(0.95); 
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease;
        }
        #fc-container.fc-visible { opacity: 1; transform: scale(1); }

        #fc-header { 
            padding: 8px 12px 8px 8px; cursor: grab; display: flex; justify-content: flex-end; align-items: center; 
            border-bottom: 1px solid var(--fc-highlightMed); 
            background: linear-gradient(90deg, transparent 0%, var(--fc-overlay) 100%);
            border-radius: 16px 16px 0 0;
        }
        #fc-header.fc-dragging { cursor: grabbing; }
        #fc-header-drag-area { flex-grow: 1; height: 32px; } /* Flexible drag space */
        #fc-controls { display: flex; align-items: center; gap: 6px; }
        .fc-control-btn { 
            background: var(--fc-surface); border: 1px solid var(--fc-highlightMed); cursor: pointer; 
            padding: 6px; border-radius: 8px; 
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; align-items: center; justify-content: center;
        }
        .fc-control-btn:hover { 
            background: var(--fc-overlay); 
            border-color: var(--fc-subtle);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .fc-control-btn svg { width: 16px; height: 16px; fill: var(--fc-subtle); display: block; transition: fill 0.2s; }
        .fc-control-btn:hover svg { fill: var(--fc-text); }

        /* Display Area (Houses both history and main display) */
        #fc-display-area { 
            padding: 8px 16px 12px; 
            background: linear-gradient(135deg, var(--fc-surface) 0%, var(--fc-overlay) 100%);
            border-radius: 0 0 12px 12px;
        }
        #fc-history-display { 
            color: var(--fc-subtle); font-size: 14px; text-align: right; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
            min-height: 18px; margin-bottom: 4px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        }
        #fc-display { 
            color: var(--fc-text); font-size: 32px; font-weight: 300; text-align: right; 
            line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; 
            min-height: 42px; border-radius: 8px; padding: 8px; cursor: pointer; 
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid transparent;
        }
        #fc-display:hover { 
            background: var(--fc-overlay); 
            border-color: var(--fc-highlightMed);
            transform: translateY(-1px);
        }
        #fc-display.fc-error-shake { animation: fc-shake 0.3s ease-in-out; }
        #fc-display.fc-copied { 
            animation: fc-copy-flash 0.6s ease-out; 
            background: var(--fc-foam) !important;
            color: var(--fc-base) !important;
        }

        /* Keypad */
        #fc-buttons { 
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; 
            border-top: 1px solid var(--fc-highlightMed); background: var(--fc-base); 
            overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease, visibility 0.3s; 
            max-height: 320px; border-radius: 0 0 16px 16px;
        }
        .fc-btn { 
            background: var(--fc-surface); color: var(--fc-text); border: 1px solid var(--fc-highlightMed); 
            border-radius: 12px; font-size: 18px; font-weight: 500; height: 52px; cursor: pointer; 
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .fc-btn:hover { 
            background: var(--fc-overlay); 
            border-color: var(--fc-subtle);
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        } 
        .fc-btn:active, .fc-btn.fc-btn-pressed { 
            transform: translateY(0px); 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .fc-btn.op { 
            background: linear-gradient(135deg, var(--fc-pine) 0%, var(--fc-foam) 100%); 
            color: white; border-color: var(--fc-pine);
        } 
        .fc-btn.op.active { 
            background: linear-gradient(135deg, var(--fc-text) 0%, var(--fc-subtle) 100%); 
            color: var(--fc-base); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .fc-btn.func { 
            background: linear-gradient(135deg, var(--fc-muted) 0%, var(--fc-subtle) 100%); 
            color: var(--fc-base); border-color: var(--fc-muted);
        } 
        .fc-btn.equals { 
            background: linear-gradient(135deg, var(--fc-foam) 0%, var(--fc-iris) 100%); 
            color: white; border-color: var(--fc-foam);
            font-weight: 600;
        }

        /* REFINED Collapsed "Spotlight" State */
        #fc-container.fc-collapsed { width: 320px; }
        #fc-container.fc-collapsed #fc-header { border-bottom: none; }
        #fc-container.fc-collapsed #fc-display-area { background-color: var(--fc-base); }
        #fc-container.fc-collapsed #fc-buttons { max-height: 0; padding: 0 10px; visibility: hidden; border-top: none; }

        /* Settings Modal (unchanged) */
        #fc-settings-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.4); backdrop-filter: blur(5px); z-index: 100000; display: none; justify-content: center; align-items: center; animation: fc-fade-in 0.3s ease; }
        #fc-settings-panel { background-color: var(--fc-base); color: var(--fc-text); border-radius: 12px; padding: 25px; width: 95%; max-width: 500px; display: flex; flex-direction: column; gap: 20px; animation: fc-scale-in 0.3s ease; max-height: 90vh; overflow-y: auto;} #fc-settings-panel h2 { color: var(--fc-pine); margin: 0; } .fc-input-group { display: flex; flex-direction: column; gap: 5px; } .fc-input-group label { color: var(--fc-subtle); font-weight: bold; } .fc-input-group select, .fc-input-group input[type="text"] { width: 100%; padding: 10px; border: 1px solid var(--fc-highlightMed); border-radius: 6px; background-color: var(--fc-surface); color: var(--fc-text); box-sizing: border-box; } .fc-settings-buttons { display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; } .fc-settings-buttons button { padding: 10px 18px; border: none; border-radius: 6px; font-weight: bold; color: white; cursor: pointer; transition: filter 0.2s; } .fc-settings-buttons button:hover { filter: brightness(1.1); } #fc-btn-reset-pos { background-color: var(--fc-gold); } #fc-btn-save { background-color: var(--fc-pine); }        #fc-custom-theme-settings { display: none; flex-direction: column; gap: 15px; border-top: 1px solid var(--fc-highlightMed); padding-top: 20px; } 
        .fc-color-input-row { display: grid; grid-template-columns: 1fr 100px 40px; gap: 10px; align-items: center; } 
        .fc-color-input-row label { color: var(--fc-subtle); white-space: nowrap; } 
        .fc-color-input-row input[type="text"] { font-family: monospace; } 
        .fc-color-input-row input[type="color"] { width: 100%; height: 35px; padding: 0; border: none; background: none; cursor: pointer; }
        
        /* Keybinding Styles */
        .fc-keybinding-container { display: flex; align-items: center; gap: 12px; }
        .fc-keybinding-display { 
            background: var(--fc-surface); border: 1px solid var(--fc-highlightMed); border-radius: 6px; 
            padding: 8px 12px; font-family: monospace; font-size: 14px; min-width: 120px; text-align: center; 
            transition: all 0.2s; color: var(--fc-text);
        }
        .fc-keybinding-display.recording { 
            background: var(--fc-foam); color: var(--fc-base); border-color: var(--fc-foam); 
            animation: pulse 1.5s infinite; 
        }
        .fc-keybinding-display.success { 
            background: var(--fc-foam); color: var(--fc-base); border-color: var(--fc-foam); 
        }
        .fc-keybinding-record { 
            background: var(--fc-surface); border: 1px solid var(--fc-highlightMed); color: var(--fc-text); 
            padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; 
            transition: all 0.2s; 
        }
        .fc-keybinding-record:hover { background: var(--fc-overlay); }
        .fc-keybinding-record:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    `);

    // --- CALCULATOR LOGIC (Unchanged) ---
    const Logic = { 
        _sanitizeResult(num) { if (typeof num !== 'number' || !isFinite(num)) return num; return parseFloat(num.toPrecision(12)); }, 
        inputDigit(digit) { if (isCopying) return; if (displayNeedsReset) { currentInput = '0'; displayNeedsReset = false; UI.updateHistoryDisplay(); } if (currentInput === '0' && digit !== '.') currentInput = ''; if (digit === '.' && currentInput.includes('.')) return; currentInput += digit; this.updateDisplay(); }, 
        setOperator(op) { if (isCopying) return; if (operator && !displayNeedsReset) this.calculate(); operator = op; previousInput = currentInput; displayNeedsReset = true; UI.updateOperatorVisuals(); UI.updateHistoryDisplay(); }, 
        calculate() { if (isCopying) return; if (!operator || !previousInput) return; if (displayNeedsReset) { currentInput = previousInput; } const prev = parseFloat(previousInput); const curr = parseFloat(currentInput); lastCalculation = `${previousInput} ${UI.getOperatorSymbol(operator)} ${currentInput} =`; let result; switch (operator) { case '+': result = this._sanitizeResult(prev + curr); break; case '-': result = this._sanitizeResult(prev - curr); break; case '*': result = this._sanitizeResult(prev * curr); break; case '/': result = curr === 0 ? 'Error' : this._sanitizeResult(prev / curr); break; default: return; } if (result === 'Error') { UI.triggerErrorAnimation(); } currentInput = String(result); operator = null; previousInput = ''; displayNeedsReset = true; this.updateDisplay(); UI.updateOperatorVisuals(); UI.updateHistoryDisplay(true); }, 
        percentage() { if (isCopying) return; if (!operator || !previousInput) { const curr = parseFloat(currentInput); currentInput = String(this._sanitizeResult(curr / 100)); displayNeedsReset = true; this.updateDisplay(); return; } const prev = parseFloat(previousInput); const curr = parseFloat(currentInput); let result; if (operator === '+' || operator === '-') { const percentValue = prev * (curr / 100); result = this._sanitizeResult((operator === '+') ? prev + percentValue : prev - percentValue); } else { const percentValue = curr / 100; if (operator === '*') { result = this._sanitizeResult(prev * percentValue); } else if (operator === '/') { result = percentValue === 0 ? 'Error' : this._sanitizeResult(prev / percentValue); } } if (result === 'Error') { UI.triggerErrorAnimation(); } lastCalculation = `${previousInput} ${UI.getOperatorSymbol(operator)} ${currentInput}% =`; currentInput = String(result); operator = null; previousInput = ''; displayNeedsReset = true; this.updateDisplay(); UI.updateOperatorVisuals(); UI.updateHistoryDisplay(true); }, 
        clearAll() { if (isCopying) return; currentInput = '0'; previousInput = ''; operator = null; lastCalculation = ''; displayNeedsReset = true; this.updateDisplay(); UI.updateOperatorVisuals(); UI.updateHistoryDisplay(); }, 
        delete() { if (isCopying || displayNeedsReset) return; if (currentInput.length > 1) { currentInput = currentInput.slice(0, -1); } else { currentInput = '0'; } this.updateDisplay(); }, 
        updateDisplay() { const display = calculatorUI.querySelector('#fc-display'); if (!display || isCopying) return; const formatted = currentInput.length > 12 && !isNaN(parseFloat(currentInput)) ? parseFloat(currentInput).toExponential(5) : currentInput; display.textContent = formatted; } 
    };

    // --- UI & DOM MANIPULATION ---
    const UI = {
        createCalculator() {
            calculatorUI = document.createElement('div');
            calculatorUI.id = 'fc-container';
            calculatorUI.innerHTML = `
                <div id="fc-header">
                    <div id="fc-header-drag-area"></div>
                    <div id="fc-controls">
                        <button id="fc-btn-settings" class="fc-control-btn" title="Settings"><svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.69-1.62-0.92L14.4,2.28c-0.05-0.24-0.27-0.42-0.52-0.42 h-3.84c-0.25,0-0.47,0.18-0.52,0.42L9.04,4.93C8.45,5.15,7.92,5.46,7.42,5.84L5.03,4.88C4.81,4.81,4.56,4.88,4.43,5.09L2.51,8.41 c-0.12,0.21-0.07,0.47,0.12,0.61l2.03,1.58C4.62,10.9,4.56,11.22,4.56,11.53c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.69,1.62,0.92l0.48,2.65 c0.05,0.24,0.27,0.42,0.52,0.42h3.84c0.25,0,0.47-0.18,0.52-0.42l0.48-2.65c0.59-0.23,1.12-0.54,1.62-0.92l2.39,0.96 c0.22,0.08,0.47,0.01,0.59-0.22l1.92-3.32c0.12-0.21,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg></button>
                        <button id="fc-btn-toggle-view" class="fc-control-btn" title="Toggle Keypad"></button>
                    </div>
                </div>
                <div id="fc-display-area">
                    <div id="fc-history-display"></div>
                    <div id="fc-display">0</div>
                </div>
                <div id="fc-buttons">
                    <button class="fc-btn func" data-action="clearAll">C</button><button class="fc-btn func" data-action="percentage" data-key="%">%</button><button class="fc-btn func" data-action="delete" data-key="Backspace">DEL</button><button class="fc-btn op" data-value="/" data-key="/">÷</button>
                    <button class="fc-btn" data-value="7" data-key="7">7</button><button class="fc-btn" data-value="8" data-key="8">8</button><button class="fc-btn" data-value="9" data-key="9">9</button><button class="fc-btn op" data-value="*" data-key="*">×</button>
                    <button class="fc-btn" data-value="4" data-key="4">4</button><button class="fc-btn" data-value="5" data-key="5">5</button><button class="fc-btn" data-value="6" data-key="6">6</button><button class="fc-btn op" data-value="-" data-key="-">−</button>
                    <button class="fc-btn" data-value="1" data-key="1">1</button><button class="fc-btn" data-value="2" data-key="2">2</button><button class="fc-btn" data-value="3" data-key="3">3</button><button class="fc-btn op" data-value="+" data-key="+">+</button>
                    <button class="fc-btn" data-value="0" data-key="0" style="grid-column: span 2;">0</button><button class="fc-btn" data-value="." data-key=".">.</button><button class="fc-btn equals" data-action="calculate" data-key="Enter">=</button>
                </div>`;
            document.body.appendChild(calculatorUI);
            if (state.isCollapsed) calculatorUI.classList.add('fc-collapsed');
            this.updateToggleViewButton();
            this.attachCalculatorEvents();
        },
        createSettings() { /* ... unchanged ... */ 
            settingsUI = document.createElement('div'); 
            settingsUI.id = 'fc-settings-modal'; 
            const colorInputsHTML = Object.entries(DEFAULTS.customColors).map(([key, val]) => { 
                const label = key.replace('--fc-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); 
                return `<div class="fc-color-input-row"> <label for="color-${key}">${label}</label> <input type="text" id="text-${key}" data-color-var="${key}"> <input type="color" id="color-${key}" data-color-var="${key}"> </div>`; 
            }).join(''); 
            settingsUI.innerHTML = `<div id="fc-settings-panel"> 
                <h2>Calculator Settings</h2> 
                <div class="fc-input-group"> 
                    <label for="fc-theme-select">Theme</label> 
                    <select id="fc-theme-select"> 
                        <option value="dawn">Rosé Pine Dawn</option> 
                        <option value="moon">Rosé Pine Moon</option> 
                        <option value="custom">Custom</option> 
                    </select> 
                </div> 
                <div class="fc-input-group"> 
                    <label for="fc-hotkey-input">Toggle Hotkey</label> 
                    <div class="fc-keybinding-container">
                        <span class="fc-keybinding-display" data-keybinding="${state.keybinding}">${this.formatKeybinding(state.keybinding)}</span>
                        <button type="button" class="fc-keybinding-record">Record New Hotkey</button>
                    </div>
                </div> 
                <div id="fc-custom-theme-settings">${colorInputsHTML}</div> 
                <div class="fc-settings-buttons"> 
                    <button id="fc-btn-reset-pos">Reset Position</button> 
                    <button id="fc-btn-save">Save & Close</button> 
                </div> 
            </div>`; 
            document.body.appendChild(settingsUI); 
            settingsUI.querySelector('#fc-btn-save').addEventListener('click', () => this.saveSettings()); 
            settingsUI.querySelector('#fc-btn-reset-pos').addEventListener('click', () => this.resetPosition()); 
            settingsUI.addEventListener('click', (e) => { if (e.target.id === 'fc-settings-modal') this.hideSettings(); }); 
            settingsUI.querySelector('#fc-theme-select').addEventListener('change', e => this.toggleCustomThemeUI(e.target.value)); 
            settingsUI.querySelectorAll('.fc-color-input-row input').forEach(input => input.addEventListener('input', e => { 
                const variable = e.target.dataset.colorVar; 
                const value = e.target.value; 
                if (e.target.type === 'color') settingsUI.querySelector(`#text-${variable}`).value = value; 
                else settingsUI.querySelector(`#color-${variable}`).value = value; 
            })); 
            
            // Setup keybinding recorder
            const recordBtn = settingsUI.querySelector('.fc-keybinding-record');
            const display = settingsUI.querySelector('.fc-keybinding-display');
            recordBtn.onclick = () => this.recordKeybinding(display, recordBtn);
        },
        showSettings() { /* ... unchanged ... */ 
            if (!settingsUI) this.createSettings(); 
            settingsUI.querySelector('#fc-theme-select').value = state.theme; 
            settingsUI.querySelector('.fc-keybinding-display').textContent = this.formatKeybinding(state.keybinding);
            settingsUI.querySelector('.fc-keybinding-display').dataset.keybinding = state.keybinding;
            Object.entries(state.customColors).forEach(([key, value]) => { 
                settingsUI.querySelector(`#text-${key}`).value = value; 
                settingsUI.querySelector(`#color-${key}`).value = value; 
            }); 
            this.toggleCustomThemeUI(state.theme); 
            settingsUI.style.display = 'flex'; 
        },
        toggleCustomThemeUI(theme) { settingsUI.querySelector('#fc-custom-theme-settings').style.display = theme === 'custom' ? 'flex' : 'none'; },
        hideSettings() { if (settingsUI) settingsUI.style.display = 'none'; },
        saveSettings() { /* ... unchanged ... */ 
            state.theme = settingsUI.querySelector('#fc-theme-select').value; 
            state.keybinding = settingsUI.querySelector('.fc-keybinding-display').dataset.keybinding; 
            if (state.theme === 'custom') { 
                settingsUI.querySelectorAll('.fc-color-input-row input[type="text"]').forEach(input => { 
                    state.customColors[input.dataset.colorVar] = input.value; 
                }); 
            } 
            GM_setValue(STORAGE_KEY, state); 
            this.applyTheme(); 
            this.hideSettings(); 
        },

        formatKeybinding(keybinding) {
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
        },

        recordKeybinding(display, recordBtn) {
            display.textContent = 'Press any key combination...';
            display.className = 'fc-keybinding-display recording';
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
                    
                    display.textContent = this.formatKeybinding(newKeybinding);
                    display.dataset.keybinding = newKeybinding;
                    display.className = 'fc-keybinding-display success';
                    
                    recordBtn.textContent = 'Record New Hotkey';
                    recordBtn.disabled = false;
                    
                    document.removeEventListener('keydown', recordingHandler, true);
                    
                    setTimeout(() => {
                        display.className = 'fc-keybinding-display';
                    }, 2000);
                } else if (event.key === 'Escape') {
                    // Cancel recording
                    display.textContent = this.formatKeybinding(display.dataset.keybinding);
                    display.className = 'fc-keybinding-display';
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
                    display.className = 'fc-keybinding-display';
                    recordBtn.textContent = 'Record New Hotkey';
                    recordBtn.disabled = false;
                    document.removeEventListener('keydown', recordingHandler, true);
                }
            }, 10000);
        },
        toggleCalculator() { if (!calculatorUI) this.createCalculator(); calculatorVisible = !calculatorVisible; if (calculatorVisible) { calculatorUI.style.display = 'flex'; setTimeout(() => calculatorUI.classList.add('fc-visible'), 10); } else { calculatorUI.classList.remove('fc-visible'); calculatorUI.addEventListener('transitionend', () => { if (!calculatorVisible) calculatorUI.style.display = 'none'; }, { once: true }); } },
        toggleCollapse() { state.isCollapsed = !state.isCollapsed; calculatorUI.classList.toggle('fc-collapsed', state.isCollapsed); this.updateToggleViewButton(); GM_setValue(STORAGE_KEY, state); },
        updateToggleViewButton() { const btn = calculatorUI.querySelector('#fc-btn-toggle-view'); if (!btn) return; const ICONS = { expand: '<svg viewBox="0 0 24 24"><path d="M4 20h16v2H4zM4 2h16v2H4zm9 6.41L15.59 11 17 9.59 12 4.58 7 9.59 8.41 11 11 8.41V15.58L8.41 13 7 14.41l5 5.01 5-5.01L15.59 13 13 15.58z"/></svg>', collapse: '<svg viewBox="0 0 24 24"><path d="M4 20h16v2H4zM4 2h16v2H4zm5 7.59L7 11.41 12 16.42l5-5.01L15.59 9.59 13 12.17V6H11v6.17z"/></svg>' }; btn.innerHTML = state.isCollapsed ? ICONS.expand : ICONS.collapse; },
        attachCalculatorEvents() {
            calculatorUI.querySelector('#fc-buttons').addEventListener('click', e => { const btn = e.target.closest('button'); if (!btn) return; const { value, action } = btn.dataset; if (value) { Logic[value.match(/[0-9.]/) ? 'inputDigit' : 'setOperator'](value); } else if (action && Logic[action]) { Logic[action](); } });
            calculatorUI.querySelector('#fc-controls').addEventListener('click', e => { const btn = e.target.closest('button'); if (!btn) return; if (btn.id === 'fc-btn-toggle-view') { this.toggleCollapse(); } else if (btn.id === 'fc-btn-settings') { this.showSettings(); } });
            calculatorUI.querySelector('#fc-display').addEventListener('click', this.copyToClipboard);
            this.attachDragEvents();
        },
        copyToClipboard() { /* ... unchanged ... */ if (isCopying) return; const displayEl = calculatorUI.querySelector('#fc-display'); const originalText = displayEl.textContent; navigator.clipboard.writeText(currentInput).then(() => { isCopying = true; displayEl.textContent = 'Copied!'; displayEl.classList.add('fc-copied'); setTimeout(() => { displayEl.textContent = originalText; displayEl.classList.remove('fc-copied'); isCopying = false; }, 1000); }).catch(err => console.error('Failed to copy text: ', err)); },
        attachDragEvents() { const handle = calculatorUI.querySelector('#fc-header'); let offsetX, offsetY, isDragging = false; handle.addEventListener('mousedown', e => { if (e.target.closest('button')) return; isDragging = true; handle.classList.add('fc-dragging'); offsetX = e.clientX - calculatorUI.offsetLeft; offsetY = e.clientY - calculatorUI.offsetTop; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp, { once: true }); }); function onMouseMove(e) { if (!isDragging) return; calculatorUI.style.left = `${e.clientX - offsetX}px`; calculatorUI.style.top = `${e.clientY - offsetY}px`; } function onMouseUp() { isDragging = false; handle.classList.remove('fc-dragging'); document.removeEventListener('mousemove', onMouseMove); state.position = { top: calculatorUI.style.top, left: calculatorUI.style.left }; GM_setValue(STORAGE_KEY, state); } },
        applyTheme() { document.body.className = document.body.className.replace(/fc-theme-\w+/g, ''); if (state.theme === 'custom') { this.applyCustomTheme(); } document.body.classList.add(`fc-theme-${state.theme}`); },
        applyCustomTheme() { let styleEl = document.getElementById('fc-custom-theme-style'); if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'fc-custom-theme-style'; document.head.appendChild(styleEl); } const cssVars = Object.entries(state.customColors).map(([key, val]) => `${key}: ${val};`).join(' '); styleEl.textContent = `body.fc-theme-custom { ${cssVars} }`; },
        applyPosition() { if (calculatorUI) Object.assign(calculatorUI.style, state.position); },
        resetPosition() { state.position = DEFAULTS.position; this.applyPosition(); GM_setValue(STORAGE_KEY, state); },
        updateOperatorVisuals() { if (activeOperatorBtn) activeOperatorBtn.classList.remove('active'); if (operator) { activeOperatorBtn = calculatorUI.querySelector(`.fc-btn.op[data-value="${operator}"]`); if (activeOperatorBtn) activeOperatorBtn.classList.add('active'); } else { activeOperatorBtn = null; } },
        triggerErrorAnimation() { const display = calculatorUI.querySelector('#fc-display'); display.classList.add('fc-error-shake'); display.addEventListener('animationend', () => display.classList.remove('fc-error-shake'), { once: true }); },
        flashButton(key) {
            let action = null;
            if (key === '=') key = 'Enter';
            if (key === 'c' || key === 'Escape' || key === 'Backspace') action = 'clearAll';
            const selector = action ? `[data-action="${action}"]` : `[data-key="${key}"]`;
            const btn = calculatorUI.querySelector(selector);
            if (btn) { btn.classList.add('fc-btn-pressed'); setTimeout(() => btn.classList.remove('fc-btn-pressed'), 150); }
        },
        getOperatorSymbol(op) { const symbols = { '*': '×', '/': '÷', '+': '+', '-': '−' }; return symbols[op] || ''; },
        updateHistoryDisplay(showLastCalc = false) { const historyDisplay = calculatorUI?.querySelector('#fc-history-display'); if (!historyDisplay) return; if (showLastCalc) { historyDisplay.textContent = lastCalculation; lastCalculation = ''; return; } if (operator && previousInput) { historyDisplay.textContent = `${previousInput} ${this.getOperatorSymbol(operator)}`; } else { historyDisplay.textContent = ''; } }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    function handleKeydown(e) {
        // Handle calculator toggle hotkey
        const keybinding = state.keybinding;
        const keys = keybinding.split('+');
        const keyCode = keys.pop(); // This will be a key code like 'KeyC', not a character
        const mods = { 
            ctrl: keys.includes('ctrl'), 
            cmd: keys.includes('cmd'),
            meta: keys.includes('meta'),
            shift: keys.includes('shift'), 
            alt: keys.includes('alt') 
        };
        
        // Handle both ctrl and cmd for cross-platform compatibility
        const hasCtrlOrCmd = e.ctrlKey || e.metaKey;
        const needsCtrlOrCmd = mods.ctrl || mods.cmd || mods.meta;
        
        // Use event.code for layout-independent comparison
        if (e.code === keyCode && 
            (!needsCtrlOrCmd || hasCtrlOrCmd) &&
            e.shiftKey === mods.shift && 
            e.altKey === mods.alt) {
            e.preventDefault();
            e.stopPropagation();
            UI.toggleCalculator();
            return;
        }

        // Handle calculator input (when calculator is visible)
        if (!calculatorVisible || document.activeElement.isContentEditable || ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (isCopying) return;
        e.preventDefault();
        UI.flashButton(e.key);

        if (e.key >= '0' && e.key <= '9' || e.key === '.') Logic.inputDigit(e.key);
        else if (['+', '-', '*', '/'].includes(e.key)) Logic.setOperator(e.key);
        else if (e.key === '%') Logic.percentage();
        else if (e.key === 'Enter' || e.key === '=') Logic.calculate();
        else if (e.key === 'Backspace') Logic.delete(); // Fixed: should delete single character
        else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') Logic.clearAll();
    }

    function main() {
        UI.applyTheme();
        GM_registerMenuCommand('Calculator Settings', () => UI.showSettings());
        document.addEventListener('keydown', handleKeydown);
        UI.createCalculator();
        UI.applyPosition();
    }
    try { main(); } catch (error) { console.error("Floating Calculator Script Error:", error); }
})();