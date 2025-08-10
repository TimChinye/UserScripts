// ==UserScript==
// @name         MooMoo.io Scroll Wheel Inventory Minimod
// @namespace    https://greasyfork.org/users/137913
// @author       TigerYT
// @description  Adds Minecraft-style inventory selection using the scroll wheel.
// @version      1.0.0
// @match        *://moomoo.io/*
// @match        *://dev.moomoo.io/*
// @match        *://sandbox.moomoo.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=moomoo.io
// @run-at       document-start
// @grant        none
// ==/UserScript==

function mainLogic() {
    'use strict';
    const SCRIPT_VERSION = "v1.0";
    console.log(`%c--- Scroll Wheel Script (${SCRIPT_VERSION}) Initialized ---`, "color: #ffb700; font-weight: bold;");

    window.ScrollDebug = {
        playerItems: {}, gameSocket: null, gameEncoder: null, gameDecoder: null, isListenerActive: false, playerResources: { food: 0, wood: 0, stone: 0 },
        testSend: (slot) => {
            console.log(`%c[Manual Test] Attempting to select slot ${slot}...`, "color: #9d4edd; font-weight: bold;");
            if (!window.ScrollDebug.gameSocket || !window.ScrollDebug.gameEncoder || window.ScrollDebug.gameSocket.readyState !== WebSocket.OPEN) return console.error("[Manual Test] FAILED: Prerequisites not met.");
            const item = window.ScrollDebug.playerItems[slot]; if (!item) return console.error(`[Manual Test] FAILED: No item for slot ${slot}.`);
            const msg = ["z", [item.id, item.itemType <= 1]];
            try { window.ScrollDebug.gameSocket.send(window.ScrollDebug.gameEncoder.encode(msg)); console.log(`%c[Manual Test] SUCCESS: Sent packet for ${item.name}.`, "color: #52b788;");
            } catch(e) { console.error("[Manual Test] FAILED: Packet send error:", e); }
        }
    };

    // --- FULL ITEM DATABASE WITH COSTS ---
    const ALL_ITEMS_DATA = [
        // Primary Weapons (itemType: 0, slot: 8)
        { id: 0, server_id: 0, itemType: 0, slot: 8, name: "Tool Hammer", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 1, server_id: 1, itemType: 0, slot: 8, name: "Hand Axe", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 2, server_id: 2, itemType: 0, slot: 8, name: "Great Axe", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 3, server_id: 3, itemType: 0, slot: 8, name: "Short Sword", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 4, server_id: 4, itemType: 0, slot: 8, name: "Katana", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 5, server_id: 5, itemType: 0, slot: 8, name: "Polearm", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 6, server_id: 6, itemType: 0, slot: 8, name: "Bat", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 7, server_id: 7, itemType: 0, slot: 8, name: "Daggers", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 8, server_id: 8, itemType: 0, slot: 8, name: "Stick", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },

        // Secondary Weapons (itemType: 1, slot: 9)
        { id: 9, server_id: 9, itemType: 1, slot: 9, name: "Hunting Bow", cost: { food: 0, wood: 4, stone: 0, gold: 0 } },
        { id: 10, server_id: 10, itemType: 1, slot: 9, name: "Great Hammer", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 11, server_id: 11, itemType: 1, slot: 9, name: "Wooden Shield", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 12, server_id: 12, itemType: 1, slot: 9, name: "Crossbow", cost: { food: 0, wood: 5, stone: 0, gold: 0 } },
        { id: 13, server_id: 13, itemType: 1, slot: 9, name: "Repeater Crossbow", cost: { food: 0, wood: 10, stone: 0, gold: 0 } },
        { id: 14, server_id: 14, itemType: 1, slot: 9, name: "MC Grabby", cost: { food: 0, wood: 0, stone: 0, gold: 0 } },
        { id: 15, server_id: 15, itemType: 1, slot: 9, name: "Musket", cost: { food: 0, wood: 0, stone: 10, gold: 0 } },

        // Food (itemType: 2, slot: 0)
        { id: 0, server_id: 16, itemType: 2, slot: 0, name: "Apple", cost: { food: 10, wood: 0, stone: 0, gold: 0 } },
        { id: 1, server_id: 17, itemType: 2, slot: 0, name: "Cookie", cost: { food: 15, wood: 0, stone: 0, gold: 0 } },
        { id: 2, server_id: 18, itemType: 2, slot: 0, name: "Cheese", cost: { food: 25, wood: 0, stone: 0, gold: 0 } },

        // Walls (itemType: 3, slot: 1)
        { id: 3, server_id: 19, itemType: 3, slot: 1, name: "Wood Wall", cost: { food: 0, wood: 10, stone: 0, gold: 0 } },
        { id: 4, server_id: 20, itemType: 3, slot: 1, name: "Stone Wall", cost: { food: 0, wood: 0, stone: 25, gold: 0 } },
        { id: 5, server_id: 21, itemType: 3, slot: 1, name: "Castle Wall", cost: { food: 0, wood: 0, stone: 35, gold: 0 } },

        // Spikes (itemType: 4, slot: 2)
        { id: 6, server_id: 22, itemType: 4, slot: 2, name: "Spikes", cost: { food: 0, wood: 20, stone: 5, gold: 0 } },
        { id: 7, server_id: 23, itemType: 4, slot: 2, name: "Greater Spikes", cost: { food: 0, wood: 30, stone: 10, gold: 0 } },
        { id: 8, server_id: 24, itemType: 4, slot: 2, name: "Poison Spikes", cost: { food: 0, wood: 35, stone: 15, gold: 0 } },
        { id: 9, server_id: 25, itemType: 4, slot: 2, name: "Spinning Spikes", cost: { food: 0, wood: 30, stone: 20, gold: 0 } },

        // Windmills (itemType: 5, slot: 3)
        { id: 10, server_id: 26, itemType: 5, slot: 3, name: "Windmill", cost: { food: 0, wood: 50, stone: 10, gold: 0 } },
        { id: 11, server_id: 27, itemType: 5, slot: 3, name: "Faster Windmill", cost: { food: 0, wood: 60, stone: 20, gold: 0 } },
        { id: 12, server_id: 28, itemType: 5, slot: 3, name: "Power Mill", cost: { food: 0, wood: 100, stone: 50, gold: 0 } },

        // Farms (itemType: 6, slot: 6)
        { id: 13, server_id: 29, itemType: 6, slot: 6, name: "Mine", cost: { food: 0, wood: 20, stone: 100, gold: 0 } },
        { id: 14, server_id: 30, itemType: 6, slot: 6, name: "Sapling", cost: { food: 0, wood: 150, stone: 0, gold: 0 } },

        // Traps (itemType: 7, slot: 4)
        { id: 15, server_id: 31, itemType: 7, slot: 4, name: "Pit Trap", cost: { food: 0, wood: 30, stone: 30, gold: 0 } },
        { id: 16, server_id: 32, itemType: 7, slot: 4, name: "Boost Pad", cost: { food: 0, wood: 5, stone: 20, gold: 0 } },

        // Extras (itemType: 8, slot: 5)
        { id: 17, server_id: 33, itemType: 8, slot: 5, name: "Turret", cost: { food: 0, wood: 200, stone: 150, gold: 0 } },
        { id: 18, server_id: 34, itemType: 8, slot: 5, name: "Platform", cost: { food: 0, wood: 20, stone: 0, gold: 0 } },
        { id: 19, server_id: 35, itemType: 8, slot: 5, name: "Healing Pad", cost: { food: 10, wood: 30, stone: 0, gold: 0 } },
        { id: 21, server_id: 37, itemType: 8, slot: 5, name: "Blocker", cost: { food: 0, wood: 30, stone: 25, gold: 0 } },
        { id: 22, server_id: 38, itemType: 8, slot: 5, name: "Teleporter", cost: { food: 0, wood: 60, stone: 60, gold: 0 } },

        // Spawn Pads (itemType: 9, slot: 7)
        { id: 20, server_id: 36, itemType: 9, slot: 7, name: "Spawn Pad", cost: { food: 0, wood: 100, stone: 100, gold: 0 } },
    ];

    const ItemDataByServerID = new Map(ALL_ITEMS_DATA.map(item => [item.server_id, item]));
    const ItemDataBySlot = new Map();
    ALL_ITEMS_DATA.forEach(item => { if (!ItemDataBySlot.has(item.slot)) ItemDataBySlot.set(item.slot, []); ItemDataBySlot.get(item.slot).push(item); });


    let selectedItemIndex = -1;
    function resetPlayerItems() { ScrollDebug.playerItems = { 8: ItemDataByServerID.get(0), 0: ItemDataByServerID.get(16), 1: ItemDataByServerID.get(19), 2: ItemDataByServerID.get(22), 3: ItemDataByServerID.get(26), }; }

    const hasResourcesFor = (slotNumber) => {
        const itemData = ALL_ITEMS_DATA.find((item) => item.server_id == slotNumber);
        if (!itemData || !itemData.cost) return false; // No data or free item
        const check = (ScrollDebug.playerResources.food >= itemData.cost.food) && (ScrollDebug.playerResources.wood >= itemData.cost.wood) && (ScrollDebug.playerResources.stone >= itemData.cost.stone);
        console.log(`[Scroll] Resource check for ${itemData.name} (Slot ${slotNumber}): ${check ? 'PASS' : 'FAIL'}. Have:`, ScrollDebug.playerResources, 'Need:', itemData.cost);
        return check;
    };

    const handleInventoryScroll = (e) => {
        console.log("%c[Scroll] === Scroll Event START ===", "color: #f72585; font-weight: bold");

        if (document.activeElement.id === 'chatBox' || !ScrollDebug.gameSocket || ScrollDebug.gameSocket.readyState !== WebSocket.OPEN || !ScrollDebug.gameEncoder) return;
        e.preventDefault();

        const actionBar = document.getElementById('actionBar');
        if (!actionBar) return;

        console.log("[Scroll] 4. Filtering available items (checking visibility, slot range, AND resources)...");
        const availableItems = Array.from(actionBar.children).filter((item) => {
            const isVisible = item.style.display !== 'none';
            if (!isVisible) return false;

            const idMatch = item.id.match(/^actionBarItem(\d+)$/);
            if (!idMatch[1]) return false;

            // NEW: Resource check
            return hasResourcesFor(parseInt(idMatch[1]));
        });
        if (availableItems.length === 0) return console.warn("[Scroll] ABORT: No available items with sufficient resources found.");
        console.log(`[Scroll] -> Found ${availableItems.length} affordable items:`, availableItems.map(i => i.id));

        const scrollDirection = e.deltaY > 0 ? 1 : -1;
        if (selectedItemIndex === -1 || selectedItemIndex >= availableItems.length) {
            selectedItemIndex = 0;
        } else {
            selectedItemIndex += scrollDirection;
        }
        if (selectedItemIndex >= availableItems.length) selectedItemIndex = 0;
        if (selectedItemIndex < 0) selectedItemIndex = availableItems.length - 1;

        const selectedElement = availableItems[selectedItemIndex];
        if (!selectedElement) return;

        const slotNumber = parseInt(selectedElement.id.match(/\d+/)[0]);
        const itemToEquip = ALL_ITEMS_DATA.find((item) => item.server_id == slotNumber);
        if (!itemToEquip) return;

        const packetID = "z";
        const args = [itemToEquip.id, itemToEquip.itemType <= 1];
        const message = [packetID, args];
        console.log(`[Scroll] -> Preparing to send for ${itemToEquip.name} (ID: ${itemToEquip.id})`, JSON.stringify(message));

        try {
            ScrollDebug.gameSocket.send(ScrollDebug.gameEncoder.encode(message));
            console.log(`%c[Scroll] -> SUCCESS! Sent packet.`, "color: #52b788; font-weight: bold;");
        } catch (err) { console.error("[Scroll] -> FAILED to send message:", err); return; }

        availableItems.forEach(item => { item.style.border = 'none'; });
        document.querySelectorAll('.actionBarItem').forEach(item => { item.style.border = 'none'; }); // Clear all just in case
        selectedElement.style.border = '2px solid yellow';
        console.log("%c[Scroll] === Scroll Event END ===", "color: #f72585; font-weight: bold");
    };

    function sortStore() {
        const storeHolder = document.getElementById('storeHolder');
        sortedItems = Array.from(storeHolder.children).filter((storeItem) => {
            if (parseInt(storeItem.id.slice("storeDisplay".length)) < 14) {
                storeItem.remove();
                return false;
            }
        }).sort((storeItemA, storeItemB) => {
            const obtainTypeA = storeItemA.children[2].textContent;
            const obtainTypeB = storeItemB.children[2].textContent;
            return obtainTypeB.localeCompare(obtainTypeA);
        });

        storeHolder.append(...sortedItems);
    };

    /**
     * Observes an element and triggers a callback when its computed 'display' property changes.
     * @param {HTMLElement} element The element to observe.
     * @param {function(string, string): void} callback The function to call on change.
     * It receives the old display value and the new display value as arguments.
     * @returns {MutationObserver} The observer instance, so you can disconnect it later if needed.
     */
    function observeDisplayChange(element, callback) {
        // Get the initial display style
        let previousDisplay = window.getComputedStyle(element).display;

        const observer = new MutationObserver((mutationsList, observer) => {
            // We only need to check the style once, even if multiple mutations occurred.
            const currentDisplay = window.getComputedStyle(element).display;

            if (currentDisplay !== previousDisplay) {
                // The display property has changed!
                callback(previousDisplay, currentDisplay);
                // Update the stored value for the next change
                previousDisplay = currentDisplay;
            }
        });

        // Start observing the element for attribute changes.
        // We watch 'style' for inline style changes and 'class' for class-based changes.
        observer.observe(element, { attributes: true, attributeFilter: ['style', 'class'] });

        return observer;
    }

    function onSocketMessage(event) {
        if (!ScrollDebug.gameDecoder) return;
        try {
            const data = ScrollDebug.gameDecoder.decode(new Uint8Array(event.data));
            const [packetID, ...args] = [data[0], ...data[1]];
            switch (packetID) {
                case "U": { // Upgrade/Buy Item
                    const itemData = ItemDataByServerID.get(args[0]);
                    if (itemData) {
                        ScrollDebug.playerItems[itemData.slot] = itemData;
                        console.info(`%c[Socket In] Tracked item update for slot ${itemData.slot} -> ${itemData.name}`, "color: #00b4d8;");
                    }
                    break;
                }
                case "P": // Player Died / Reset
                    console.info(`%c[Socket In] Death/Reset packet received. Resetting items.`, "color: #fca311;");
                    resetPlayerItems();
                    break;
                case "N": { // Resource Update
                    const resourceType = args[0] === 'points' ? 'gold' : args[0];
                    const amount = args[1];
                    ScrollDebug.playerResources[resourceType] = amount;
                    console.log(`%c[Socket In] Resource Update: ${resourceType} = ${amount}`, 'color: #80ed99');

                    sortStore();
                    break;
                }
            }
        } catch (e) { /* Ignore */ }
    }

    // --- HOOKING LOGIC ---
    let codecsFound = 0;
    const onCodecFound = () => {
        codecsFound++;
        if (codecsFound === 2 && !ScrollDebug.isListenerActive) {
            console.log("%c[Init] SUCCESS: Encoder & Decoder found. Activating scroll listener.", "color: #52b788; font-size: 1.2em; font-weight: bold;");
            document.addEventListener('wheel', handleInventoryScroll, { passive: true });
            ScrollDebug.isListenerActive = true;
        }
    };
    const hookPrototype = (propName, check, onFound) => {
        const originalDesc = Object.getOwnPropertyDescriptor(Object.prototype, propName);
        Object.defineProperty(Object.prototype, propName, {
            set(value) {
                if (originalDesc && originalDesc.set) originalDesc.set.call(this, value); else this[`_${propName}`] = value;
                if (check(this)) {
                    console.log(`%c[Init] Hook triggered for "${propName}"!`, "color: #2a9d8f; font-weight: bold;");
                    Object.defineProperty(Object.prototype, propName, originalDesc || { value: this[propName], writable: true, configurable: true });
                    onFound(this);
                }
            },
            get() { return originalDesc && originalDesc.get ? originalDesc.get.call(this) : this[`_${propName}`]; },
            configurable: true
        });
    };

    hookPrototype("initialBufferSize", (obj) => obj && obj.initialBufferSize && !ScrollDebug.gameEncoder, (obj) => { ScrollDebug.gameEncoder = obj; onCodecFound(); });
    hookPrototype("maxExtLength", (obj) => obj && obj.maxExtLength && !ScrollDebug.gameDecoder, (obj) => { ScrollDebug.gameDecoder = obj; onCodecFound(); });

    const originalWebSocket = window.WebSocket;
    window.WebSocket = new Proxy(originalWebSocket, {
        construct(target, args) {
            const ws = new target(...args);
            ScrollDebug.gameSocket = ws; resetPlayerItems();
            ws.addEventListener('message', onSocketMessage);
            window.WebSocket = originalWebSocket;

            // NEW: Apply CSS changes on game entry
            try {
                const storeMenu = document.getElementById('storeMenu');
                storeMenu.style.transform = 'translateY(0px)';
                storeMenu.style.top = '20px';
                storeMenu.style.height = 'calc(100% - 108px)';

                const storeHolder = document.getElementById('storeHolder');
                storeHolder.style.height = 'calc(100% - 124px)';
                storeHolder.style.maxHeight = '100%';
                console.log("%c[Init] Applied custom store CSS.", "color: #e07a5f;");

                setTimeout(() => {
                    const resourcesValues = Array.from(document.getElementById('resDisplay').children).map((resDisplay) => resDisplay.textContent);
                    window.ScrollDebug.playerResources = { food: resourcesValues[0], wood: resourcesValues[1], stone: resourcesValues[2], gold: resourcesValues[3] };
                }, 3000);

            } catch(e) { console.warn("[Init] Could not apply custom store CSS (elements might not be ready yet)."); }

            return ws;
        }
    });
}

mainLogic();

/*
// --- The Injector ---
const scriptToInject = document.createElement('script');
scriptToInject.textContent = `(${mainLogic.toString()})();`;
document.documentElement.appendChild(scriptToInject);
scriptToInject.remove();
*/