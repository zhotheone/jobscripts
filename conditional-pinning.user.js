// ==UserScript==
// @name         Conditional Element Pinning
// @namespace    https://yourdomain.com
// @version      1.0
// @description  Pin important page elements (reminders, notes) when scrolling past trigger point
// @author       You
// @match        *://essaycock.com/support/dashboard/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_NAME = 'ConditionalElementPinning';

    // --- Logger Module ---
    const Logger = (() => {
        return {
            debug: (message, ...args) => console.debug(`[${SCRIPT_NAME}] [DEBUG] ${message}`, ...args),
            info: (message, ...args) => console.info(`[${SCRIPT_NAME}] [INFO] ${message}`, ...args),
            warn: (message, ...args) => console.warn(`[${SCRIPT_NAME}] [WARN] ${message}`, ...args),
            error: (message, ...args) => console.error(`[${SCRIPT_NAME}] [ERROR] ${message}`, ...args),
        };
    })();

    // --- Utils Module ---
    const Utils = (() => {
        return {
            debounce: (func, delay) => {
                let timeout;
                return function(...args) {
                    const context = this;
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(context, args), delay);
                };
            }
        };
    })();

    // --- Settings Module ---
    const Settings = (() => {
        const SETTINGS_KEY = 'conditional_pinning_settings_v1';
        let currentSettings = {};

        const defaultSettings = {
            enabled: true,
            targetHost: 'essaycock.com',
            targetBasePath: '/support/dashboard',
            menuListSelector: '.col-sm-3.col-md-2.menu-list',
            triggerSelector: '.form-group',
            remindersSelector: '.reminders-block.well.well-xs.bg-info',
            notesSelector: '.notes-block.well.well-xs.bg-info',
            viewportTopOffset: 15,
            marginBetweenElements: 10,
            bottomMargin: 20
        };

        async function load() {
            const saved = await GM_getValue(SETTINGS_KEY, null);
            let loadedSettings = { ...defaultSettings };

            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    loadedSettings = { ...loadedSettings, ...parsed };
                } catch (e) {
                    Logger.error("Error parsing saved settings, using defaults.", e);
                }
            }
            currentSettings = loadedSettings;
            return currentSettings;
        }

        async function save(settingsToSave) {
            currentSettings = { ...settingsToSave };
            await GM_setValue(SETTINGS_KEY, JSON.stringify(currentSettings));
            Logger.info('Settings saved:', currentSettings);
        }

        function getCurrent() {
            return { ...currentSettings };
        }

        return { load, save, getCurrent };
    })();

    // --- ElementPinning Module ---
    const ElementPinning = (() => {
        const state = { 
            menuList: null, 
            triggerFormGroup: null, 
            remindersBlock: null, 
            notesBlock: null, 
            remindersPlaceholder: null, 
            notesPlaceholder: null, 
            originalRemindersStyle: '', 
            originalNotesStyle: '', 
            originalRemindersWidth: '', 
            originalNotesWidth: '', 
            isPinned: false, 
            scrollResizeHandlerAttached: false, 
            domObserver: null 
        };

        function createOrUpdatePlaceholder(element, placeholderRef) {
            if (!element || !element.parentNode) return placeholderRef;
            let placeholder = placeholderRef;
            const computedStyle = window.getComputedStyle(element);
            const currentWidth = computedStyle.width;
            const currentHeight = computedStyle.height;
            const marginTop = computedStyle.marginTop;
            const marginBottom = computedStyle.marginBottom;

            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.classList.add('cp-pinned-placeholder');
                element.parentNode.insertBefore(placeholder, element);
            }
            placeholder.style.width = currentWidth;
            placeholder.style.height = currentHeight;
            placeholder.style.marginTop = marginTop;
            placeholder.style.marginBottom = marginBottom;
            placeholder.style.display = 'none'; // Will be shown when element is pinned
            return placeholder;
        }

        function applyOverflowAndMaxHeight(element, currentTopPx, settings) {
            if (!element) return;
            const availableHeight = window.innerHeight - currentTopPx - settings.bottomMargin;
            // Temporarily reset to get natural scrollHeight
            const prevMaxHeight = element.style.maxHeight;
            const prevOverflowY = element.style.overflowY;
            element.style.maxHeight = 'none';
            element.style.overflowY = 'visible';
            const contentHeight = element.scrollHeight;
            // Restore previous styles before making decision
            element.style.maxHeight = prevMaxHeight;
            element.style.overflowY = prevOverflowY;

            if (contentHeight > availableHeight && availableHeight > 50) { // Min height for scrollable area
                element.style.maxHeight = `${Math.max(50, availableHeight)}px`;
                element.style.overflowY = 'auto';
            } else {
                element.style.maxHeight = 'none';
                element.style.overflowY = 'visible';
            }
        }

        function pinElements(menuListLeftPosition, settings) {
            if (state.isPinned) return;
            Logger.debug('[Pinning] Pinning elements.');

            if (state.remindersBlock) {
                state.remindersPlaceholder = createOrUpdatePlaceholder(state.remindersBlock, state.remindersPlaceholder);
                if (state.remindersPlaceholder) state.remindersPlaceholder.style.display = 'block';
            }
            if (state.notesBlock) {
                state.notesPlaceholder = createOrUpdatePlaceholder(state.notesBlock, state.notesPlaceholder);
                if (state.notesPlaceholder) state.notesPlaceholder.style.display = 'block';
            }

            let currentTop = settings.viewportTopOffset;
            if (state.remindersBlock) {
                state.remindersBlock.style.position = 'fixed';
                state.remindersBlock.style.left = `${menuListLeftPosition}px`;
                state.remindersBlock.style.width = state.originalRemindersWidth;
                state.remindersBlock.style.zIndex = '1001';
                state.remindersBlock.style.top = `${currentTop}px`;
                applyOverflowAndMaxHeight(state.remindersBlock, currentTop, settings);
                currentTop += state.remindersBlock.getBoundingClientRect().height + settings.marginBetweenElements;
            }
            if (state.notesBlock) {
                state.notesBlock.style.position = 'fixed';
                state.notesBlock.style.left = `${menuListLeftPosition}px`;
                state.notesBlock.style.width = state.originalNotesWidth;
                state.notesBlock.style.zIndex = '1000';
                state.notesBlock.style.top = `${currentTop}px`;
                applyOverflowAndMaxHeight(state.notesBlock, currentTop, settings);
            }
            state.isPinned = true;
        }

        function unpinElements() {
            if (!state.isPinned) return;
            Logger.debug('[Pinning] Unpinning elements.');
            if (state.remindersBlock) {
                state.remindersBlock.style.cssText = state.originalRemindersStyle;
                if (state.remindersPlaceholder) state.remindersPlaceholder.style.display = 'none';
            }
            if (state.notesBlock) {
                state.notesBlock.style.cssText = state.originalNotesStyle;
                if (state.notesPlaceholder) state.notesPlaceholder.style.display = 'none';
            }
            state.isPinned = false;
        }

        function updatePinnedElementsLayout(menuListLeftPosition, settings) {
            if (!state.isPinned) return;
            let currentTop = settings.viewportTopOffset;
            if (state.remindersBlock) {
                state.remindersBlock.style.left = `${menuListLeftPosition}px`;
                state.remindersBlock.style.top = `${currentTop}px`;
                applyOverflowAndMaxHeight(state.remindersBlock, currentTop, settings);
                currentTop += state.remindersBlock.getBoundingClientRect().height + settings.marginBetweenElements;
            }
            if (state.notesBlock) {
                state.notesBlock.style.left = `${menuListLeftPosition}px`;
                state.notesBlock.style.top = `${currentTop}px`;
                applyOverflowAndMaxHeight(state.notesBlock, currentTop, settings);
            }
        }

        const debouncedHandleScrollAndResize = Utils.debounce(() => {
            const s = Settings.getCurrent();
            if (!s.enabled) {
                if (state.isPinned) unpinElements();
                return;
            }
            if (!state.menuList || !state.triggerFormGroup || (!state.remindersBlock && !state.notesBlock)) {
                if (state.isPinned) unpinElements();
                return;
            }
            // Ensure elements are still in DOM
            if (!document.body.contains(state.menuList) ||
                !document.body.contains(state.triggerFormGroup) ||
                (state.remindersBlock && !document.body.contains(state.remindersBlock)) ||
                (state.notesBlock && !document.body.contains(state.notesBlock))
            ) {
                Logger.warn('[Pinning] Key elements detached from DOM. Attempting re-initialization.');
                initialize(s);
                return;
            }

            const menuListRect = state.menuList.getBoundingClientRect();
            const triggerRect = state.triggerFormGroup.getBoundingClientRect();
            const shouldBePinned = triggerRect.bottom < s.viewportTopOffset && menuListRect.bottom > s.viewportTopOffset;

            if (shouldBePinned) {
                if (!state.isPinned) pinElements(menuListRect.left, s);
                else updatePinnedElementsLayout(menuListRect.left, s);
            } else {
                if (state.isPinned) unpinElements();
            }
        }, 50);

        function initialize(settings) {
            const isOnTargetPage = location.hostname.includes(settings.targetHost) && location.pathname.startsWith(settings.targetBasePath);

            if (!settings.enabled || !isOnTargetPage) {
                if (state.isPinned) unpinElements();
                if (state.scrollResizeHandlerAttached) {
                    window.removeEventListener('scroll', debouncedHandleScrollAndResize);
                    window.removeEventListener('resize', debouncedHandleScrollAndResize);
                    state.scrollResizeHandlerAttached = false;
                    Logger.debug('[Pinning] Listeners removed.');
                }
                if (state.domObserver) {
                    state.domObserver.disconnect();
                    state.domObserver = null;
                    Logger.debug('[Pinning] DOM observer disconnected.');
                }
                document.querySelectorAll('.cp-pinned-placeholder').forEach(p => p.remove());
                // Reset state fields
                Object.keys(state).forEach(key => {
                    if (key !== 'isPinned' && key !== 'scrollResizeHandlerAttached' && key !== 'domObserver') {
                        state[key] = null;
                    }
                });
                return;
            }

            Logger.info('[Pinning] Initializing on target page.');
            state.menuList = document.querySelector(settings.menuListSelector);
            if (!state.menuList) { 
                Logger.warn('[Pinning] Menu list not found:', settings.menuListSelector); 
                return; 
            }

            state.triggerFormGroup = state.menuList.querySelector(settings.triggerSelector);
            state.remindersBlock = state.menuList.querySelector(settings.remindersSelector);
            state.notesBlock = state.menuList.querySelector(settings.notesSelector);

            if (!state.triggerFormGroup) { 
                Logger.warn('[Pinning] Trigger element not found:', settings.triggerSelector); 
                return; 
            }

            if (!state.isPinned) {
                if (state.remindersBlock) {
                    state.originalRemindersStyle = state.remindersBlock.style.cssText || "";
                    state.originalRemindersWidth = window.getComputedStyle(state.remindersBlock).width;
                }
                if (state.notesBlock) {
                    state.originalNotesStyle = state.notesBlock.style.cssText || "";
                    state.originalNotesWidth = window.getComputedStyle(state.notesBlock).width;
                }
            }

            if (!state.scrollResizeHandlerAttached) {
                window.addEventListener('scroll', debouncedHandleScrollAndResize, { passive: true });
                window.addEventListener('resize', debouncedHandleScrollAndResize);
                state.scrollResizeHandlerAttached = true;
                Logger.debug('[Pinning] Scroll/resize listeners attached.');
            }

            if (!state.domObserver) {
                state.domObserver = new MutationObserver((mutationsList, observer) => {
                    for (const mutation of mutationsList) {
                        if (mutation.type === 'childList' || mutation.type === 'subtree') {
                            const currentSettings = Settings.getCurrent();
                            const newMenuList = document.querySelector(currentSettings.menuListSelector);
                            if (newMenuList !== state.menuList ||
                                (newMenuList && newMenuList.querySelector(currentSettings.triggerSelector) !== state.triggerFormGroup) ||
                                (newMenuList && newMenuList.querySelector(currentSettings.remindersSelector) !== state.remindersBlock) ||
                                (newMenuList && newMenuList.querySelector(currentSettings.notesSelector) !== state.notesBlock)
                            ) {
                                Logger.debug('[Pinning] DOM mutation detected affecting key pinning elements. Re-initializing pinning.');
                                initialize(currentSettings);
                                return;
                            }
                        }
                    }
                    debouncedHandleScrollAndResize();
                });
                state.domObserver.observe(document.body, { childList: true, subtree: true });
                Logger.debug('[Pinning] DOM observer attached to document.body.');
            }
            debouncedHandleScrollAndResize();
        }

        return { initialize };
    })();

    // --- Main App ---
    const App = (() => {
        async function start() {
            Logger.info(`Script ${SCRIPT_NAME} starting.`);
            const settings = await Settings.load();
            
            const initialize = () => {
                ElementPinning.initialize(settings);
            };

            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(initialize, 100);
            } else {
                document.addEventListener('DOMContentLoaded', initialize);
            }

            // Monitor URL changes for SPAs
            let lastUrl = location.href;
            const urlChangeObserver = new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    Logger.info(`URL change detected: ${location.href}`);
                    ElementPinning.initialize(Settings.getCurrent());
                }
            });
            urlChangeObserver.observe(document.documentElement, { childList: true, subtree: true });

            window.addEventListener('popstate', () => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    Logger.info(`Popstate navigation detected: ${location.href}`);
                    ElementPinning.initialize(Settings.getCurrent());
                }
            });

            Logger.info('[App] Conditional pinning initialized.');
        }

        return { start };
    })();

    // --- Script Entry Point ---
    App.start().catch(err => Logger.error("Critical error in App.start():", err));

})();
