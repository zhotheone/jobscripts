// ==UserScript==
// @name         Quick Action Panel
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Quick action panel with customizable hotkeys for essay service dashboard
// @author       Assistant
// @match        https://essaycock.com/*
// @match        https://speedypaper.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Default hotkey configuration
    let hotkeys = {
        'KeyQ': 'togglePanel',
        'KeyN': 'addNote',
        'KeyM': 'sendMessage',
        'KeyT': 'createReminder',
        'ShiftKeyT': 'createReminderAction',
        'KeyD': 'scrollToOrderDetails',
        'KeyF': 'scrollToFiles'
    };

    // Load saved hotkeys from localStorage
    function loadHotkeys() {
        const saved = localStorage.getItem('quickActionHotkeys');
        if (saved) {
            try {
                hotkeys = { ...hotkeys, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load hotkeys:', e);
            }
        }
    }

    // Save hotkeys to localStorage
    function saveHotkeys() {
        localStorage.setItem('quickActionHotkeys', JSON.stringify(hotkeys));
    }

    // Create the quick action panel
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'quick-action-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: white;
            display: none;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>⚡ Quick Actions</span>
            <button id="close-panel" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; margin: 0;">×</button>
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            padding: 20px;
            max-height: 500px;
            overflow-y: auto;
        `;

        const actions = [
            { key: 'N', action: 'addNote', label: 'Add Note', icon: '📝' },
            { key: 'M', action: 'sendMessage', label: 'Send Message', icon: '💬' },
            { key: 'T', action: 'createReminder', label: 'Focus Reminder', icon: '⏰' },
            { key: 'Shift+T', action: 'createReminderAction', label: 'Create Reminder', icon: '✨' },
            { key: 'D', action: 'scrollToOrderDetails', label: 'Order Details', icon: '📋' },
            { key: 'F', action: 'scrollToFiles', label: 'Files Section', icon: '📁' }
        ];

        actions.forEach(item => {
            const actionDiv = document.createElement('div');
            actionDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: all 0.2s ease;
                border-radius: 6px;
                margin: 2px 0;
            `;
            
            actionDiv.onmouseover = () => {
                actionDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                actionDiv.style.transform = 'translateX(5px)';
            };
            
            actionDiv.onmouseout = () => {
                actionDiv.style.backgroundColor = 'transparent';
                actionDiv.style.transform = 'translateX(0)';
            };

            const currentKey = Object.keys(hotkeys).find(k => hotkeys[k] === item.action) || 'Key' + item.key;
            const displayKey = item.key === 'Shift+T' ? 'Shift+T' : currentKey.replace('Key', '').replace('Digit', '').replace('Shift', 'Shift+');

            actionDiv.innerHTML = `
                <span style="font-size: 18px; margin-right: 12px;">${item.icon}</span>
                <span style="flex: 1; font-weight: 500;">${item.label}</span>
                <kbd style="background: rgba(255, 255, 255, 0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${displayKey}</kbd>
            `;

            actionDiv.onclick = () => executeAction(item.action);
            content.appendChild(actionDiv);
        });

        // Settings button
        const settingsDiv = document.createElement('div');
        settingsDiv.style.cssText = `
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
        `;
        settingsDiv.innerHTML = `
            <button id="settings-btn" style="
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
            ">⚙️ Customize Hotkeys</button>
        `;
        content.appendChild(settingsDiv);

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('close-panel').onclick = () => togglePanel();
        document.getElementById('settings-btn').onclick = () => showHotkeySettings();

        return panel;
    }

    // Toggle panel visibility
    function togglePanel() {
        const panel = document.getElementById('quick-action-panel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            panel.style.transform = 'translateX(100%)';
            setTimeout(() => {
                panel.style.transform = 'translateX(0)';
            }, 10);
        } else {
            panel.style.transform = 'translateX(100%)';
            setTimeout(() => {
                panel.style.display = 'none';
            }, 300);
        }
    }

    // Execute actions based on the action type
    function executeAction(action) {
        try {
            const actions = {
                addNote: () => {
                    try {
                        const noteTextarea = document.getElementById('create-note-textarea');
                        
                        if (noteTextarea) {
                            noteTextarea.focus();
                            noteTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Scroll up by 200px to give more space
                            setTimeout(() => {
                                try {
                                    window.scrollBy(0, -200);
                                } catch (e) {
                                    console.log('Scroll adjustment failed:', e);
                                }
                            }, 500);
                            showNotification('Note textarea focused');
                        } else {
                            showNotification('Note textarea not found', 'error');
                        }
                    } catch (e) {
                        console.error('Error in addNote:', e);
                        showNotification('Error focusing note area', 'error');
                    }
                },
                
                sendMessage: () => {
                    try {
                        const messageTextarea = document.getElementById('client-message-textarea-id');
                        if (messageTextarea) {
                            messageTextarea.focus();
                            messageTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Scroll up by 200px to give more space
                            setTimeout(() => {
                                try {
                                    window.scrollBy(0, -200);
                                } catch (e) {
                                    console.log('Scroll adjustment failed:', e);
                                }
                            }, 500);
                            showNotification('Message textarea focused');
                        } else {
                            showNotification('Message textarea not found', 'error');
                        }
                    } catch (e) {
                        console.error('Error in sendMessage:', e);
                        showNotification('Error focusing message area', 'error');
                    }
                },
                
                createReminder: () => {
                    try {
                        // First check if reminder form is already visible
                        const reminderForm = document.getElementById('reminder-create');
                        const reminderTextarea = document.querySelector('textarea[placeholder="Reminder text"]');
                        
                        if (reminderTextarea && reminderTextarea.offsetParent !== null) {
                            // Form is already visible, just focus the textarea
                            reminderTextarea.focus();
                            reminderTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                try {
                                    window.scrollBy(0, -200);
                                } catch (e) {
                                    console.log('Scroll adjustment failed:', e);
                                }
                            }, 500);
                            showNotification('Reminder textarea focused');
                        } else {
                            // Form is hidden, need to show it first
                            const showFormButtons = document.querySelectorAll('button');
                            let showFormBtn = null;
                            
                            // Find the "Show the form" button
                            for (let btn of showFormButtons) {
                                if (btn.textContent && btn.textContent.trim().toLowerCase().includes('show the form')) {
                                    showFormBtn = btn;
                                    break;
                                }
                            }
                            
                            if (showFormBtn) {
                                // Click the show form button
                                showFormBtn.click();
                                showNotification('Opening reminder form...');
                                
                                // Wait for form to appear, then focus textarea
                                setTimeout(() => {
                                    try {
                                        const textarea = document.querySelector('textarea[placeholder="Reminder text"]');
                                        if (textarea) {
                                            textarea.focus();
                                            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            setTimeout(() => {
                                                try {
                                                    window.scrollBy(0, -200);
                                                } catch (e) {
                                                    console.log('Scroll adjustment failed:', e);
                                                }
                                            }, 500);
                                            showNotification('Reminder form opened and focused');
                                        } else {
                                            showNotification('Reminder textarea not found after opening form', 'error');
                                        }
                                    } catch (e) {
                                        console.error('Error after opening reminder form:', e);
                                        showNotification('Error after opening reminder form', 'error');
                                    }
                                }, 300);
                            } else {
                                showNotification('Show form button not found', 'error');
                            }
                        }
                    } catch (e) {
                        console.error('Error in createReminder:', e);
                        showNotification('Error with reminder form', 'error');
                    }
                },
                
                createReminderAction: () => {
                    try {
                        const reminderBtn = document.getElementById('reminders-container-create-reminder-button');
                        if (reminderBtn) {
                            reminderBtn.click();
                            showNotification('Reminder created');
                        } else {
                            showNotification('Create reminder button not found', 'error');
                        }
                    } catch (e) {
                        console.error('Error in createReminderAction:', e);
                        showNotification('Error creating reminder', 'error');
                    }
                },
                
                scrollToOrderDetails: () => {
                    try {
                        // Try multiple selectors for order details
                        const orderDetailsSelectors = [
                            '.panel.panel-warning', // Main order details panel
                            '.order-panel-header', // Order header
                            '.panel-heading', // Any panel heading
                            '[class*="order-panel"]', // Any class containing "order-panel"
                            '#order_bage', // Order badge/number
                            '.container-fluid.admin-dashboard .panel' // First panel in admin dashboard
                        ];
                        
                        let orderDetails = null;
                        
                        for (let selector of orderDetailsSelectors) {
                            try {
                                orderDetails = document.querySelector(selector);
                                if (orderDetails) break;
                            } catch (e) {
                                console.log('Selector failed:', selector, e);
                            }
                        }
                        
                        // Also try to find by text content
                        if (!orderDetails) {
                            try {
                                const elements = document.querySelectorAll('.panel-heading, h2, h3, h4');
                                for (let el of elements) {
                                    if (el.textContent && el.textContent.toLowerCase().includes('order details')) {
                                        orderDetails = el.closest('.panel') || el;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.log('Text search failed:', e);
                            }
                        }
                        
                        if (orderDetails) {
                            orderDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            // Highlight the section
                            try {
                                orderDetails.style.outline = '2px solid #4ecdc4';
                                orderDetails.style.backgroundColor = 'rgba(78, 205, 196, 0.1)';
                                setTimeout(() => {
                                    try {
                                        if (orderDetails && orderDetails.style) {
                                            orderDetails.style.outline = '';
                                            orderDetails.style.backgroundColor = '';
                                        }
                                    } catch (e) {
                                        console.log('Highlight removal failed:', e);
                                    }
                                }, 2000);
                            } catch (e) {
                                console.log('Highlighting failed:', e);
                            }
                            showNotification('Scrolled to order details');
                        } else {
                            showNotification('Order details section not found', 'error');
                        }
                    } catch (e) {
                        console.error('Error in scrollToOrderDetails:', e);
                        showNotification('Error scrolling to order details', 'error');
                    }
                },
                
                scrollToFiles: () => {
                    try {
                        // Look for files section with multiple strategies
                        let filesElement = null;
                        
                        // Strategy 1: Look for paperclip icons (file attachments)
                        try {
                            const paperclipIcons = document.querySelectorAll('i.fa-paperclip');
                            if (paperclipIcons.length > 0) {
                                filesElement = paperclipIcons[0].closest('.list-group-item, .well, .message');
                            }
                        } catch (e) {
                            console.log('Paperclip search failed:', e);
                        }
                        
                        // Strategy 2: Look for file links (containing file extensions or "download")
                        if (!filesElement) {
                            try {
                                const fileLinks = document.querySelectorAll('a[href*=".pdf"], a[href*=".doc"], a[href*=".docx"], a[target="_blank"]');
                                if (fileLinks.length > 0) {
                                    filesElement = fileLinks[0].closest('.list-group-item, .well, .message');
                                }
                            } catch (e) {
                                console.log('File link search failed:', e);
                            }
                        }
                        
                        // Strategy 3: Look for text mentioning files
                        if (!filesElement) {
                            try {
                                const allElements = document.querySelectorAll('*');
                                for (let el of allElements) {
                                    if (el.textContent && 
                                        (el.textContent.includes('.pdf') || 
                                         el.textContent.includes('.doc') || 
                                         el.textContent.includes('FINAL') || 
                                         el.textContent.includes('PREVIEW') ||
                                         el.textContent.includes('file'))) {
                                        filesElement = el.closest('.list-group-item, .well, .message') || el;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.log('Text search failed:', e);
                            }
                        }
                        
                        // Strategy 4: Look in messages panel for attachments
                        if (!filesElement) {
                            try {
                                const messagesPanel = document.querySelector('.messagesBox, [class*="message"]');
                                if (messagesPanel) {
                                    const listItems = messagesPanel.querySelectorAll('.list-group-item, li');
                                    for (let item of listItems) {
                                        if (item.querySelector('a[target="_blank"], i.fa-paperclip') || 
                                            item.textContent.includes('.')) {
                                            filesElement = item;
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log('Messages panel search failed:', e);
                            }
                        }
                        
                        if (filesElement) {
                            filesElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Highlight the files area
                            try {
                                filesElement.style.outline = '3px solid #ff6b6b';
                                filesElement.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
                                setTimeout(() => {
                                    try {
                                        if (filesElement && filesElement.style) {
                                            filesElement.style.outline = '';
                                            filesElement.style.backgroundColor = '';
                                        }
                                    } catch (e) {
                                        console.log('Highlight removal failed:', e);
                                    }
                                }, 3000);
                            } catch (e) {
                                console.log('Highlighting failed:', e);
                            }
                            showNotification('Files section found and highlighted');
                        } else {
                            showNotification('No files found on this page', 'warning');
                        }
                    } catch (e) {
                        console.error('Error in scrollToFiles:', e);
                        showNotification('Error finding files section', 'error');
                    }
                }
            };

            if (actions[action]) {
                actions[action]();
            } else {
                console.log('Unknown action:', action);
                showNotification('Unknown action: ' + action, 'error');
            }
        } catch (e) {
            console.error('Error in executeAction:', e);
            showNotification('Unexpected error occurred', 'error');
        }
    }

    // Show notification
    function showNotification(message, type = 'success') {
        try {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'error' ? '#ff6b6b' : type === 'warning' ? '#ffa726' : '#4ecdc4'};
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                z-index: 10001;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            // Animate in
            setTimeout(() => {
                try {
                    notification.style.opacity = '1';
                    notification.style.transform = 'translateX(-50%) translateY(0)';
                } catch (e) {
                    console.log('Notification animation failed:', e);
                }
            }, 10);

            // Remove after 3 seconds
            setTimeout(() => {
                try {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(-50%) translateY(-20px)';
                    setTimeout(() => {
                        try {
                            if (notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }
                        } catch (e) {
                            console.log('Notification removal failed:', e);
                        }
                    }, 300);
                } catch (e) {
                    console.log('Notification cleanup failed:', e);
                }
            }, 3000);
        } catch (e) {
            console.error('Error creating notification:', e);
            // Fallback to alert if notification fails
            alert(message);
        }
    }

    // Show hotkey settings dialog
    function showHotkeySettings() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10002;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        dialog.innerHTML = `
            <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Customize Hotkeys</h2>
            <p style="color: #666; margin-bottom: 20px;">Click on a hotkey to change it. Press ESC to cancel.</p>
            <div id="hotkey-list"></div>
            <div style="margin-top: 20px; text-align: right;">
                <button id="reset-hotkeys" style="background: #ff6b6b; color: white; border: none; padding: 8px 16px; border-radius: 6px; margin-right: 10px; cursor: pointer;">Reset to Default</button>
                <button id="save-hotkeys" style="background: #4ecdc4; color: white; border: none; padding: 8px 16px; border-radius: 6px; margin-right: 10px; cursor: pointer;">Save</button>
                <button id="cancel-hotkeys" style="background: #999; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cancel</button>
            </div>
        `;

        const hotkeyList = dialog.querySelector('#hotkey-list');
        
        Object.entries(hotkeys).forEach(([key, action]) => {
            if (action === 'togglePanel') return; // Skip toggle panel
            
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            `;
            
            const displayKey = key.replace('Key', '').replace('Digit', '');
            row.innerHTML = `
                <span style="color: #333;">${action.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                <button class="hotkey-btn" data-action="${action}" data-current="${key}" style="
                    background: #f8f9fa;
                    border: 1px solid #ddd;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    min-width: 60px;
                ">${displayKey}</button>
            `;
            
            hotkeyList.appendChild(row);
        });

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Hotkey button listeners
        let changingKey = null;
        document.querySelectorAll('.hotkey-btn').forEach(btn => {
            btn.onclick = () => {
                if (changingKey) {
                    changingKey.style.background = '#f8f9fa';
                    changingKey.textContent = changingKey.dataset.current.replace('Key', '').replace('Digit', '');
                }
                changingKey = btn;
                btn.style.background = '#667eea';
                btn.style.color = 'white';
                btn.textContent = 'Press key...';
            };
        });

        // Key listener for changing hotkeys
        const keyListener = (e) => {
            if (changingKey && e.code !== 'Escape') {
                e.preventDefault();
                const newKey = e.code;
                const action = changingKey.dataset.action;
                const oldKey = changingKey.dataset.current;
                
                // Remove old binding
                delete hotkeys[oldKey];
                // Add new binding
                hotkeys[newKey] = action;
                
                changingKey.dataset.current = newKey;
                changingKey.textContent = newKey.replace('Key', '').replace('Digit', '');
                changingKey.style.background = '#f8f9fa';
                changingKey.style.color = 'black';
                changingKey = null;
            } else if (e.code === 'Escape' && changingKey) {
                changingKey.style.background = '#f8f9fa';
                changingKey.style.color = 'black';
                changingKey.textContent = changingKey.dataset.current.replace('Key', '').replace('Digit', '');
                changingKey = null;
            }
        };

        document.addEventListener('keydown', keyListener);

        // Dialog button listeners
        document.getElementById('save-hotkeys').onclick = () => {
            saveHotkeys();
            document.removeEventListener('keydown', keyListener);
            document.body.removeChild(overlay);
            showNotification('Hotkeys saved successfully');
            // Recreate panel to reflect changes
            const oldPanel = document.getElementById('quick-action-panel');
            if (oldPanel) oldPanel.remove();
            createPanel();
        };

        document.getElementById('cancel-hotkeys').onclick = () => {
            document.removeEventListener('keydown', keyListener);
            document.body.removeChild(overlay);
        };

        document.getElementById('reset-hotkeys').onclick = () => {
            if (confirm('Reset all hotkeys to default?')) {
                hotkeys = {
                    'KeyQ': 'togglePanel',
                    'KeyN': 'addNote',
                    'KeyM': 'sendMessage',
                    'KeyT': 'createReminder',
                    'ShiftKeyT': 'createReminderAction',
                    'KeyD': 'scrollToOrderDetails',
                    'KeyF': 'scrollToFiles'
                };
                saveHotkeys();
                document.removeEventListener('keydown', keyListener);
                document.body.removeChild(overlay);
                showNotification('Hotkeys reset to default');
                // Recreate panel to reflect changes
                const oldPanel = document.getElementById('quick-action-panel');
                if (oldPanel) oldPanel.remove();
                createPanel();
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.removeEventListener('keydown', keyListener);
                document.body.removeChild(overlay);
            }
        };
    }

    // Keyboard event listener
    function handleKeypress(e) {
        try {
            // Check if Alt is pressed (without Ctrl/Cmd)
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                let action = null;
                
                // Handle special case for Shift+T
                if (e.shiftKey && e.code === 'KeyT') {
                    action = hotkeys['ShiftKeyT'];
                } else if (!e.shiftKey) {
                    action = hotkeys[e.code];
                }
                
                if (action) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (action === 'togglePanel') {
                        togglePanel();
                    } else {
                        executeAction(action);
                    }
                }
            }
        } catch (e) {
            console.error('Error in handleKeypress:', e);
            try {
                showNotification('Keyboard shortcut error', 'error');
            } catch (notificationError) {
                console.error('Failed to show notification:', notificationError);
            }
        }
    }

    // Initialize
    function init() {
        loadHotkeys();
        createPanel();
        document.addEventListener('keydown', handleKeypress);
        
        // Show welcome message
        setTimeout(() => {
            showNotification('Quick Action Panel loaded! Press Alt+Q to toggle.');
        }, 1000);
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
