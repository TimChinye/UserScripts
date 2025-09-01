// ==UserScript==
// @name         AI Studio Mod - Dynamic Table of Contents + Revert Scrollbar
// @namespace    https://greasyfork.org/users/137913
// @description  Adds a dynamic TOC with smart scrolling for long sections to the settings panel.
// @author       TigerYT
// @version      2.3.0
// @match        *://aistudio.google.com/prompts/*
// @icon         https://www.gstatic.com/aistudio/ai_studio_favicon_2_32x32.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. APPLY CUSTOM STYLES ---
    function applyCustomStyles() {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) {
            console.error('[TOC MOD] Could not find document head to inject styles.');
            return;
        }

        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'ai-studio-mod-styles'; // Give it an ID to prevent duplicates
        style.textContent = `
            /* Revert scrollbar behavior by making the container's overflow visible */
            ms-autoscroll-container:not(#_) {
                overflow: visible;
            }
            /* Hide the custom scrollbar component */
            ms-prompt-scrollbar {
                display: none;
            }
            /* Common style for all jump links */
            .toc-jump-link {
                color: var(--google-blue-600, #1a73e8);
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
            }
            .toc-jump-link:hover {
                text-decoration: underline;
            }
        `;

        if (!document.getElementById(style.id)) {
            head.append(style);
        }
    }

    // --- 2. THE CORE LOGIC TO BUILD/UPDATE THE TABLE OF CONTENTS ---
    function updateTableOfContents(settingsContainer, chatBox) {

        // A. Clear any previously generated TOC elements to prevent duplication.
        const oldElements = settingsContainer.querySelectorAll('.toc-generated-item');
        oldElements.forEach(el => el.remove());

        // B. Create the static container elements for the TOC.
        const dividerElement = document.createElement('mat-divider');
        dividerElement.setAttribute('_ngcontent-ng-c1976526210', '');
        dividerElement.setAttribute('role', 'separator');
        dividerElement.setAttribute('aria-orientation', 'horizontal');
        dividerElement.className = 'mat-divider mat-divider-horizontal ng-star-inserted toc-generated-item';

        const headingElement = document.createElement('h3');
        headingElement.setAttribute('_ngcontent-ng-c1211128260', '');
        headingElement.className = 'thinking-group-title ng-tns-c1211128260-17 toc-generated-item';
        headingElement.textContent = 'Table of Contents';

        const tocItemsContainer = document.createElement('div');
        tocItemsContainer.setAttribute('_ngcontent-ng-c19765210', '');
        tocItemsContainer.className = 'advanced-settings ng-star-inserted toc-generated-item';

        // C. Find all chat turns and create a link for each one.
        const chatTurns = Array.from(chatBox.firstElementChild.children)
                               .filter((elem) => elem.tagName === 'MS-CHAT-TURN');

        if (chatTurns.length > 0) {
            chatTurns.forEach((elem, index) => {
                let responseName = 'Unknown Turn';

                const responseElem = elem?.firstElementChild?.children?.[1];
                if (responseElem) {
                    switch (responseElem.dataset.turnRole) {
                        case "User":
                            responseName = 'User Input';
                            break;
                        case "Model":
                            responseName = responseElem.classList.contains('author-label') ? 'Model Thinking' : 'Model Output';
                            break;
                    }
                }

                // --- STRUCTURE CREATION ---

                // 1. Create the main container DIV for the row
                const tocItemContainer = document.createElement('div');
                tocItemContainer.className = 'mat-mdc-tooltip-trigger settings-item ng-tns-c1211128260-12 toc-generated-item';
                tocItemContainer.setAttribute('_ngcontent-ng-c1211128260', '');

                // 2. Create the P element for the label
                const labelElement = document.createElement('p');
                labelElement.className = 'v3-font-body ng-tns-c1211128260-12';
                labelElement.setAttribute('_ngcontent-ng-c1211128260', '');
                labelElement.textContent = (index + 1) + '. ' + responseName;

                // 3. Create a span to hold all action links
                const actionsSpan = document.createElement('span');

                // 4. Check if the element is taller than the viewport
                const isTallerThanViewport = elem.offsetHeight > window.innerHeight;

                if (isTallerThanViewport) {
                    // If it's too tall, add the special 'scroll to bottom' link
                    const jumpLinkDown = document.createElement('a');
                    jumpLinkDown.className = 'toc-jump-link';
                    jumpLinkDown.textContent = '↓';
                    jumpLinkDown.title = 'Scroll to the bottom of this turn';
                    // Apply special styling
                    jumpLinkDown.style.color = 'oklch(from var(--color-v3-text-link) l c calc(h - 30))';
                    jumpLinkDown.style.marginRight = '1ch';
                    jumpLinkDown.addEventListener('click', () => {
                        elem.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' });
                    });
                    actionsSpan.append(jumpLinkDown);
                }

                // 5. Always add the standard 'Go To' (scroll to top) link
                const jumpLinkGoTo = document.createElement('a');
                jumpLinkGoTo.className = 'toc-jump-link';
                jumpLinkGoTo.textContent = 'Go To';
                jumpLinkGoTo.title = 'Scroll to the top of this turn';
                jumpLinkGoTo.addEventListener('click', () => {
                    elem.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
                });
                actionsSpan.append(jumpLinkGoTo);

                // 6. Assemble and append the final element
                tocItemContainer.append(labelElement, actionsSpan);
                tocItemsContainer.append(tocItemContainer);
            });
        }

        // D. Insert the newly created TOC elements into the settings panel.
        if (chatTurns.length > 0) {
            settingsContainer.insertAdjacentElement('beforeend', dividerElement);
            settingsContainer.insertAdjacentElement('beforeend', headingElement);
            settingsContainer.insertAdjacentElement('beforeend', tocItemsContainer);
        }
    }


    // --- 3. OBSERVER SETUP ---
    function initializeAndMonitor() {
        const observer = new MutationObserver((mutations, obs) => {
            const settingsContainer = document.querySelector('ms-prompt-run-settings');
            const chatBox = document.querySelector('ms-autoscroll-container');

            if (settingsContainer && chatBox && chatBox.firstElementChild) {
                obs.disconnect();
                updateTableOfContents(settingsContainer, chatBox);

                let debounceTimer;
                const chatObserver = new MutationObserver(() => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        updateTableOfContents(settingsContainer, chatBox);
                    }, 250);
                });

                chatObserver.observe(chatBox.firstElementChild, { childList: true });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // --- 4. SCRIPT ENTRY POINT ---
    applyCustomStyles();
    initializeAndMonitor();

})();
