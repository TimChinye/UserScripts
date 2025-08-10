// ==UserScript==
// @name         MooMoo.io Scroll Wheel Inventory Minimod
// @namespace    https://greasyfork.org/users/137913
// @author       TigerYT
// @description  Adds Minecraft-style inventory selection using the scroll wheel.
// @version      2.0.0
// @match        *://moomoo.io/*
// @match        *://dev.moomoo.io/*
// @match        *://sandbox.moomoo.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=moomoo.io
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Main module for the Scroll Wheel Inventory script.
     * Encapsulates all state, data, and logic to avoid polluting the global scope.
     */
    const ScrollWheelMod = {
        // --- CONFIGURATION ---
        config: {
            DEBUG_MODE: true, // Set to true to see detailed logs in the console.
            SELECTION_BORDER_STYLE: '2px solid white',
        },

        // --- STATE MANAGEMENT ---
        state: {
            isListenerActive: false,
            gameSocket: null,
            gameEncoder: null,
            gameDecoder: null,
            selectedItemIndex: -1,
            playerId: -1,
            playerResources: { food: 0, wood: 0, stone: 0, gold: 0 }
        },

        // --- CORE DATA ---
        // A structured and more readable item database.
        data: {
            // Processed maps for quick lookups.
            _itemDataByServerId: new Map(),
            _itemDataBySlot: new Map(),

            // Raw item data, grouped by category for readability.
            _rawItems: {
                PRIMARY_WEAPONS: [
                    { id: 0, server_id: 0, name: "Tool Hammer" }, { id: 1, server_id: 1, name: "Hand Axe" }, { id: 3, server_id: 3, name: "Short Sword" },
                    { id: 4, server_id: 4, name: "Katana" }, { id: 5, server_id: 5, name: "Polearm" }, { id: 6, server_id: 6, name: "Bat" },
                    { id: 7, server_id: 7, name: "Daggers" }, { id: 8, server_id: 8, name: "Stick" }, { id: 2, server_id: 2, name: "Great Axe" },
                ],
                SECONDARY_WEAPONS: [
                    { id: 9, server_id: 9, name: "Hunting Bow", cost: { wood: 4 } }, { id: 10, server_id: 10, name: "Great Hammer" },
                    { id: 11, server_id: 11, name: "Wooden Shield" }, { id: 12, server_id: 12, name: "Crossbow", cost: { wood: 5 } },
                    { id: 13, server_id: 13, name: "Repeater Crossbow", cost: { wood: 10 } }, { id: 14, server_id: 14, name: "MC Grabby" },
                    { id: 15, server_id: 15, name: "Musket", cost: { stone: 10 } },
                ],
                FOOD: [
                    { id: 0, server_id: 16, name: "Apple", cost: { food: 10 } }, { id: 1, server_id: 17, name: "Cookie", cost: { food: 15 } },
                    { id: 2, server_id: 18, name: "Cheese", cost: { food: 25 } },
                ],
                WALLS: [
                    { id: 3, server_id: 19, name: "Wood Wall", cost: { wood: 10 } }, { id: 4, server_id: 20, name: "Stone Wall", cost: { stone: 25 } },
                    { id: 5, server_id: 21, name: "Castle Wall", cost: { stone: 35 } },
                ],
                SPIKES: [
                    { id: 6, server_id: 22, name: "Spikes", cost: { wood: 20, stone: 5 } }, { id: 7, server_id: 23, name: "Greater Spikes", cost: { wood: 30, stone: 10 } },
                    { id: 8, server_id: 24, name: "Poison Spikes", cost: { wood: 35, stone: 15 } }, { id: 9, server_id: 25, name: "Spinning Spikes", cost: { wood: 30, stone: 20 } },
                ],
                WINDMILLS: [
                    { id: 10, server_id: 26, name: "Windmill", cost: { wood: 50, stone: 10 } }, { id: 11, server_id: 27, name: "Faster Windmill", cost: { wood: 60, stone: 20 } },
                    { id: 12, server_id: 28, name: "Power Mill", cost: { wood: 100, stone: 50 } },
                ],
                FARMS: [
                    { id: 13, server_id: 29, name: "Mine", cost: { wood: 20, stone: 100 } }, { id: 14, server_id: 30, name: "Sapling", cost: { wood: 150 } },
                ],
                TRAPS: [
                    { id: 15, server_id: 31, name: "Pit Trap", cost: { wood: 30, stone: 30 } }, { id: 16, server_id: 32, name: "Boost Pad", cost: { wood: 5, stone: 20 } },
                ],
                EXTRAS: [
                    { id: 17, server_id: 33, name: "Turret", cost: { wood: 200, stone: 150 } }, { id: 18, server_id: 34, name: "Platform", cost: { wood: 20 } },
                    { id: 19, server_id: 35, name: "Healing Pad", cost: { food: 10, wood: 30 } }, { id: 21, server_id: 37, name: "Blocker", cost: { wood: 30, stone: 25 } },
                    { id: 22, server_id: 38, name: "Teleporter", cost: { wood: 60, stone: 60 } },
                ],
                SPAWN_PADS: [
                    { id: 20, server_id: 36, name: "Spawn Pad", cost: { wood: 100, stone: 100 } },
                ],
            },

            _packetNames: {
                'io-init': 'Initial Connection',
                '0': 'Ping',
                '1': 'Clan Disbanded',
                '2': 'Clan Join Request',
                '3': 'Leave / Disband Clan',
                '4': 'Clan Member Update',
                '5': 'Store / Shop State Update',
                '6': 'Chat Message Received',
                '7': 'Unknown Event',
                '8': 'Player Hit Effect?',
                'A': 'All Clans List',
                'C': 'Client Player Initialization',
                'D': 'Other Player Spawn',
                'E': 'Player Despawn',
                'G': 'Leaderboard Update',
                'H': 'Create Map Objects',
                'I': 'All Animals / NPCs State Update',
                'J': 'Boss Skill / Animation Trigger',
                'K': 'Player Attack Animation',
                'L': 'Object Damaged',
                'M': 'Turret Fired',
                'N': 'Resource Update',
                'O': 'Player Health Update',
                'P': 'Player Death / Reset',
                'Q': 'Remove Map Object',
                'R': 'Remove Player-Placed Objects',
                'S': 'Item Count Update',
                'T': 'Player XP Update / Age Up',
                'U': 'Upgrade / Buy Item',
                'V': 'Ability State Update?',
                'X': 'Create Projectile',
                'Y': 'Projectile Distance?',
                'a': 'All Players State Update',
                'g': 'Clan Created'
            },

            _packetFormatters: {
                'io-init': ([socketID]) => ({ socketID }),
                '0': () => ({}),
                '1': ([clanSID]) => ({ clanSID }),
                '2': ([requestingPlayerName, requestingPlayerID]) => ({ requestingPlayerName, requestingPlayerID }),
                '3': (data) => ({ data }), // Payload is unclear, log raw
                '4': (members) => ({ members: members.map(([id, name]) => ({ id, name })) }),
                '5': ([action, itemID, state]) => ({ action, itemID, state }), // Corrected based on new docs
                '6': ([playerID, message]) => ({ playerID, message }),
                '7': ([state]) => ({ state }),
                '8': ([x, y, size, type]) => ({ x, y, size, type }),
                'A': ([data]) => data,
                'C': ([playerID]) => ({ playerID }),
                'D': ([data, isClientPlayer]) => ({ // Corrected based on new docs
                    socketID: data[0], id: data[1], nickname: data[2], x: data[3], y: data[4],
                    angle: data[5], health: data[6], maxHealth: data[7], size: data[8], skinID: data[9],
                    isClientPlayer
                }),
                'E': ([socketID]) => ({ socketID }),
                'G': (args) => {
                    const leaderboard = [];
                    for (let i = 0; i < args.length; i += 3) leaderboard.push({ rank: args[i], name: args[i+1], score: args[i+2] });
                    return { leaderboard };
                },
                'H': (args) => ({ objectCount: args.length / 8 }), // Summarized for readability
                'I': (args) => ({ npcCount: args.length / 7 }),    // Summarized for readability
                'J': ([animationID]) => ({ animationID }),
                'K': ([attackingPlayerID, victimPlayerID, unknown]) => ({ attackingPlayerID, victimPlayerID, unknown }),
                'L': ([playerAnimAngle, objectID]) => ({ playerAnimAngle, objectID }),
                'M': ([turretObjectID, angle]) => ({ turretObjectID, angle }),
                'N': ([resourceType, newAmount, source]) => ({ resourceType: resourceType === 'points' ? 'gold' : resourceType, newAmount, source }),
                'O': ([playerID, newHealth]) => ({ playerID, newHealth }),
                'P': () => ({}),
                'Q': ([objectID]) => ({ objectID }),
                'R': ([playerID]) => ({ playerID }),
                'S': ([serverItemID, newCount]) => ({ serverItemID, newCount }),
                'T': (args) => { // Corrected based on new docs
                    if (args.length === 1) return { currentExp: args[0] };
                    if (args.length === 3) return { currentExp: args[0], requiredExp: args[1], nextAge: args[2] };
                    return { rawData: args }; // Fallback for unexpected length
                },
                'U': ([serverItemID, levelOrCount]) => ({ serverItemID, levelOrCount }),
                'V': (args) => args.length === 1 ? { data: args[0] } : { data: args[0], unknown: args[1] },
                'X': ([x, y, angle, type, speed, range, ownerID, damage]) => ({ x, y, angle, type, speed, range, ownerID, damage }),
                'Y': ([unknown, value]) => ({ unknown, value }),
                'a': (args) => ({ playerCount: args.length / 13 }), // Summarized for readability
                'g': (data) => ({ newClan: data[0] })
            },
            
            // This function processes the raw data into usable formats.
            initialize() {
                const itemTypes = {
                    PRIMARY_WEAPONS: { itemType: 0, slot: 8 }, SECONDARY_WEAPONS: { itemType: 1, slot: 9 }, FOOD: { itemType: 2, slot: 0 },
                    WALLS: { itemType: 3, slot: 1 }, SPIKES: { itemType: 4, slot: 2 }, WINDMILLS: { itemType: 5, slot: 3 },
                    FARMS: { itemType: 6, slot: 6 }, TRAPS: { itemType: 7, slot: 4 }, EXTRAS: { itemType: 8, slot: 5 }, SPAWN_PADS: { itemType: 9, slot: 7 },
                };

                for (const category in this._rawItems) {
                    const { itemType, slot } = itemTypes[category];
                    this._rawItems[category].forEach(item => {
                        const fullItemData = {
                            ...item,
                            itemType,
                            slot,
                            cost: { food: 0, wood: 0, stone: 0, gold: 0, ...item.cost } // Ensure all costs are defined
                        };
                        this._itemDataByServerId.set(fullItemData.server_id, fullItemData);
                        if (!this._itemDataBySlot.has(fullItemData.slot)) {
                            this._itemDataBySlot.set(fullItemData.slot, []);
                        }
                        this._itemDataBySlot.get(fullItemData.slot).push(fullItemData);
                    });
                }
            },
        },

        // --- LOGIC ---
        
        /**
         * Checks if the player has enough resources to afford an item.
         * @param {number} serverId - The server-side ID of the item to check.
         * @returns {boolean} - True if the player can afford the item.
         */
        canAffordItem(serverId) {
            const itemData = this.data._itemDataByServerId.get(serverId);
            if (!itemData || !itemData.cost) return true; // Free items are always affordable

            const canAfford = this.state.playerResources.food >= itemData.cost.food &&
                              this.state.playerResources.wood >= itemData.cost.wood &&
                              this.state.playerResources.stone >= itemData.cost.stone;
            return canAfford;
        },

        // --- EVENT HANDLERS & NETWORK ---
        
        /**
         * The main handler for the 'wheel' event. Orchestrates the item selection process.
         * @param {WheelEvent} event - The DOM wheel event.
         */
        handleInventoryScroll(event) {
            // 1. Check Preconditions
            const isVisible = (elem) => elem.style.display === 'block';

            const chatHolder = document.getElementById('chatHolder');
            const storeMenu = document.getElementById('storeMenu');
            const allianceMenu = document.getElementById('allianceMenu');

            if (isVisible(storeMenu) || isVisible(allianceMenu) || isVisible(chatHolder) || !this.state.gameSocket || this.state.gameSocket.readyState !== WebSocket.OPEN) return;
            
            event.preventDefault();

            // 2. Get available items
            const actionBar = document.getElementById('actionBar');
            if (!actionBar) return;

            const affordableItems = Array.from(actionBar.children).filter(itemEl => {
                const isVisible = itemEl.style.display !== 'none';
                if (!isVisible) return false;
                const idMatch = itemEl.id.match(/^actionBarItem(\d+)$/);
                if (!idMatch) return false;
                return this.canAffordItem(parseInt(idMatch[1]));
            });

            if (affordableItems.length === 0) {
                 Logger.warn("No affordable items available to scroll through.");
                 return;
            }

            // 3. Calculate next index
            const scrollDirection = event.deltaY > 0 ? 1 : -1;
            this.state.selectedItemIndex = (this.state.selectedItemIndex + scrollDirection + affordableItems.length) % affordableItems.length;

            // 4. Select and equip item
            const selectedElement = affordableItems[this.state.selectedItemIndex];
            const serverId = parseInt(selectedElement.id.match(/\d+/)[0]);
            const itemToEquip = this.data._itemDataByServerId.get(serverId);

            if (itemToEquip) {
                this.sendEquipItem(itemToEquip);
                this.updateSelectionUI(affordableItems, selectedElement);
            }
        },

        /**
         * Sends the WebSocket packet to the server to equip an item.
         * @param {object} itemData - The data object for the item to equip.
         */
        sendEquipItem(itemData) {
            try {
                const isWeapon = itemData.itemType <= 1;
                const message = ['z', [itemData.id, isWeapon]];
                this.state.gameSocket.send(this.state.gameEncoder.encode(message));
            } catch (err) {
                Logger.error("Failed to send equip packet.", err);
            }
        },
        
        /**
         * Updates the action bar UI to highlight the newly selected item.
         * @param {HTMLElement[]} allItems - All available item elements.
         * @param {HTMLElement} selectedItem - The element to highlight.
         */
        updateSelectionUI(allItems, selectedItem) {
            allItems.forEach(item => item.style.border = 'none');
            if (selectedItem) {
                selectedItem.style.border = this.config.SELECTION_BORDER_STYLE;
            }
        },

        /**
         * Handles incoming WebSocket messages to track game state.
         * @param {MessageEvent} event - The WebSocket message event.
         */
        handleSocketMessage(event) {
            if (!this.state.gameDecoder) return;

            try {
                const [packetID, ...argsArr] = this.state.gameDecoder.decode(new Uint8Array(event.data));
                const args = argsArr[0]; // The game nests args in another array

                const packetName = this.data._packetNames[packetID] || 'Unknown Packet';
                const packetData = this.data._packetFormatters[packetID] ? this.data._packetFormatters[packetID](args) : { rawData: args };
                switch (packetName) {
                    case 'Client Player Initialization': {
                        this.data.playerId = packetData.playerID;
                    }
                    case 'Other Player Spawn': {
                        if (this.data.playerId == packetData.id && packetData.isClientPlayer) {
                            setTimeout(() => this.onGameReady(), 0);
                        }
                    }
                    case 'Resource Update': {
                        const resourceType = args[0] === 'points' ? 'gold' : args[0];
                        this.state.playerResources[resourceType] = args[1];
                        break;
                    }
                }
        
                // --- 2. Log Every Packet in the Desired Format ---
                /*
                {
                    'io-init': 'Initial Connection',
                    'I': 'All Animals / NPCs State Update',
                    'a': 'All Players State Update',
                    '0': 'Ping',
                    '7': 'Unknown Periodic Event'
                    'H': 'Create Map Objects',
                    'G': 'Leaderboard Update',
                    'K': 'Player Attack Animation',
                    'L': 'Object Damaged',
                    'T': 'Player XP Update / Age Up',
                }
                */
                if (['I', 'a', '0', '7', 'H', 'G', 'K', 'L', 'T'].includes(packetID.toString())) return;
                if ('O' == packetID.toString() && args[0] != this.data.playerId) return;

                const dataString = Object.keys(packetData).length > 0 ? JSON.stringify(packetData) : '{}';
                console.log(`Packet ID: ${packetID} - Name: ${packetName} - ${dataString}`, args);
            } catch (e) { /* Ignore decoding errors for packets we don't care about */ }
        },

        // --- INITIALIZATION & HOOKING ---

        /**
         * This function is a clever way to find the game's msgpack encoder/decoder instances.
         * It temporarily redefines a property setter on Object.prototype. When the game's code
         * creates an object with a specific property (like 'initialBufferSize'), our setter
         * fires, allowing us to grab a reference to that object.
         * @param {string} propName - The unique property name to watch for.
         * @param {Function} onFound - The callback to execute when the object is found.
         */
        hookIntoPrototype(propName, onFound) {
            const originalDesc = Object.getOwnPropertyDescriptor(Object.prototype, propName);
            Object.defineProperty(Object.prototype, propName, {
                set(value) {
                    // Restore original setter behavior
                    if (originalDesc && originalDesc.set) {
                        originalDesc.set.call(this, value);
                    } else {
                        this[`_${propName}`] = value;
                    }
                    // Our check and callback
                    if (this && this[propName] !== undefined) {
                        Object.defineProperty(Object.prototype, propName, originalDesc || { value, writable: true, configurable: true });
                        onFound(this);
                    }
                },
                get() {
                    return originalDesc && originalDesc.get ? originalDesc.get.call(this) : this[`_${propName}`];
                },
                configurable: true,
            });
        },
        
        /**
         * Sets up all the necessary hooks to integrate with the game.
         */
        initializeHooks() {
            // Hook 1: Find msgpack codecs
            let codecsFound = 0;
            const onCodecFound = () => {
                codecsFound++;
                if (codecsFound === 2 && !this.state.isListenerActive) {
                    // Note: `passive: false` is required to use `preventDefault()`.
                    document.addEventListener('wheel', this.handleInventoryScroll.bind(this), { passive: false });
                    this.state.isListenerActive = true;
                }
            };
            this.hookIntoPrototype("initialBufferSize", (obj) => { this.state.gameEncoder = obj; onCodecFound(); });
            this.hookIntoPrototype("maxExtLength", (obj) => { this.state.gameDecoder = obj; onCodecFound(); });

            // Hook 2: Intercept WebSocket creation
            const originalWebSocket = window.WebSocket;
            window.WebSocket = new Proxy(originalWebSocket, {
                construct: (target, args) => {
                    const wsInstance = new target(...args);
                    
                    this.state.gameSocket = wsInstance;
                    wsInstance.addEventListener('message', this.handleSocketMessage.bind(this));
                    
                    // Restore the original WebSocket constructor now that we're done
                    window.WebSocket = originalWebSocket;

                    return wsInstance;
                }
            });
        },

        /**
         * This function runs once the WebSocket is established and the game is ready.
         */
        onGameReady() {
            try {
                const storeMenu = document.getElementById('storeMenu');
                storeMenu.style.transform = 'translateY(0px)';
                storeMenu.style.top = '20px';
                storeMenu.style.height = 'calc(100% - 240px)';

                const storeHolder = document.getElementById('storeHolder');
                storeHolder.style.height = '100%';

                const resElements = document.getElementById('resDisplay').children;
                this.state.playerResources = {
                    food: parseInt(resElements[0].textContent) || 0,
                    wood: parseInt(resElements[1].textContent) || 0,
                    stone: parseInt(resElements[2].textContent) || 0,
                    gold: parseInt(resElements[3].textContent) || 0
                };
            } catch(e) {
                Logger.error("Could not scrape initial resources.", e);
            }
        },

        /**
         * The main entry point for the script.
         */
        init() {
            Logger.log(`--- Scroll Wheel Script Initializing ---`, "color: #ffb700; font-weight: bold;");
            this.data.initialize();
            this.initializeHooks();
            
            // Expose for debugging if needed
            window.ScrollWheelMod = this;
        }
    };

    /**
     * A simple, configurable logger to avoid cluttering the console.
     */
    const Logger = {
        log: (message, ...args) => ScrollWheelMod.config.DEBUG_MODE && console.log(`%c[SWI-Mod] ${message}`, ...args),
        info: (message, ...args) => ScrollWheelMod.config.DEBUG_MODE && console.info(`%c[SWI-Mod] ${message}`, ...args),
        warn: (message, ...args) => ScrollWheelMod.config.DEBUG_MODE && console.warn(`[SWI-Mod] ${message}`, ...args),
        error: (message, ...args) => console.error(`[SWI-Mod] ${message}`, ...args), // Always show errors
    };

    // --- START THE SCRIPT ---
    ScrollWheelMod.init();

})();