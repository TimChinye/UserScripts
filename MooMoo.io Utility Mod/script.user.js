// ==UserScript==
// @name         MOOMOO.IO Utility Mod! (Scroll Wheel Inventory, Wearables Hotbar, Typing Indicator, More!)
// @namespace    https://greasyfork.org/users/137913
// @description  This mod adds a number of mini-mods to enhance your MooMoo.io experience whilst not being too unfair to non-script users.
// @license      GNU GPLv3 with the condition: no auto-heal or instant kill features may be added to the licensed material.
// @author       TigerYT
// @version      0.7.7
// @grant        none
// @match        *://moomoo.io/*
// @match        *://dev.moomoo.io/*
// @match        *://sandbox.moomoo.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=moomoo.io
// @run-at       document-start
// ==/UserScript==

/*
Version numbers: A.B.C
A = Added or made a major change to multiple mini-mods
B = Added or made a major change to a feature (a whole mini-mod, or major parts within a mini-mod)
C = Added patches
*/

(function() {
    'use strict';

    /**
     * @module Logger
     * @description A simple, configurable logger to prefix messages and avoid cluttering the console.
     * It respects the `DEBUG_MODE` flag in the main module's config.
     */
    const Logger = {
        /**
         * Logs a standard message.
         * @param {string} message The message to log.
         * @param {...any} args Additional arguments to pass to console.log.
         */
        log: (message, ...args) => MooMooUtilityMod.config.DEBUG_MODE && console.log(`%c[Util-Mod] ${message}`, ...args),
        /**
         * Logs an informational message.
         * @param {string} message The message to log.
         * @param {...any} args Additional arguments to pass to console.info.
         */
        info: (message, ...args) => MooMooUtilityMod.config.DEBUG_MODE && console.info(`%c[Util-Mod] ${message}`, ...args),
        /**
         * Logs a warning.
         * @param {string} message The message to log.
         * @param {...any} args Additional arguments to pass to console.warn.
         */
        warn: (message, ...args) => MooMooUtilityMod.config.DEBUG_MODE && console.warn(`[Util-Mod] ${message}`, ...args),
        /**
         * Logs an error. Always shown regardless of DEBUG_MODE.
         * @param {string} message The message to log.
         * @param {...any} args Additional arguments to pass to console.error.
         */
        error: (message, ...args) => console.error(`[Util-Mod] ${message}`, ...args),
    };

    /**
     * @module MooMooUtilityMod
     * @description The core of the utility mod. It manages shared state, data, network hooks,
     * and initializes all registered "minimods".
     */
    const MooMooUtilityMod = {

        // --- CORE MOD PROPERTIES ---

        /**
         * @property {object} config - Holds user-configurable settings for the script.
         */
        config: {
            /** @property {boolean} DEBUG_MODE - Set to true to see detailed logs in the console. */
            DEBUG_MODE: true,
        },

        /**
         * @property {object} state - Holds the dynamic state of the script, changing as the user plays.
         */
        state: {
            /** @property {boolean} isListenerActive - Tracks if the 'wheel' event listener has been attached. */
            isListenerActive: false,

            /** @property {boolean} isSandbox - Tracks if the player is in sandbox mode for item limits. */
            isSandbox: window.location.host.startsWith('sandbox.'),

            /** @property {WebSocket|null} gameSocket - A reference to the game's main WebSocket instance. */
            gameSocket: null,

            /** @property {object|null} gameEncoder - A reference to the game's msgpack encoder instance. */
            gameEncoder: null,

            /** @property {object|null} gameDecoder - A reference to the game's msgpack decoder instance. */
            gameDecoder: null,

            /** @property {number} playerId - The client player's unique ID assigned by the server. */
            playerId: -1,

            /** @property {{food: number, wood: number, stone: number, gold: number}} playerResources - The player's current resource counts. */
            playerResources: { food: 0, wood: 0, stone: 0, gold: 0 },

            /** @property {Map<number, number>} playerPlacedItemCounts - Maps an item's limit group ID to the number of items placed from that group. */
            playerPlacedItemCounts: new Map(),

            /** @property {boolean} playerHasRespawned - Tracks if the player has respawned. */
            playerHasRespawned: false
        },

        /**
         * @property {object} data - Contains structured, static data about the game, such as items and packet definitions.
         */
        data: {
            /** @property {Map<number, object>} _itemDataByServerId - A map for quickly looking up item data by its server-side ID. */
            _itemDataByServerId: new Map(),

            /** @property {Map<number, object[]>} _itemDataBySlot - A map for grouping items by their action bar slot. */
            _itemDataBySlot: new Map(),

            /**
             * @property {object} constants - A collection of named constants to avoid "magic values" in the code.
             * These are "universal" constants that multiple minimods may need access to.
             */
            constants: {
                PACKET_TYPES: {
                    USE_ITEM: 'F',
                    EQUIP_ITEM: 'z',
                    EQUIP_WEARABLE: 'c'
                },
                PACKET_DATA: {
                    WEARABLE_TYPES: {
                        HAT: 'hat',
                        ACCESSORY: 'accessory',
                    },
                    STORE_ACTIONS: {
                        ADD_ITEM: 'buy',
                        UPDATE_EQUIPPED: 'equip',
                    },
                    USE_ACTIONS: {
                        START_USING: 1,
                        STOP_USING: 0,
                    }
                },
                ITEM_TYPES: {
                    PRIMARY_WEAPON: 0,
                    SECONDARY_WEAPON: 1,
                    FOOD: 2,
                    WALL: 3,
                    SPIKE: 4,
                    WINDMILL: 5,
                    FARM: 6,
                    TRAP: 7,
                    EXTRA: 8,
                    SPAWN_PAD: 9
                },
                DOM: {
                    // IDs
                    STORE_MENU: 'storeMenu',
                    STORE_HOLDER: 'storeHolder',
                    RESOURCE_DISPLAY: 'resDisplay',
                    CHAT_HOLDER: 'chatHolder',
                    ALLIANCE_MENU: 'allianceMenu',
                    ACTION_BAR: 'actionBar',
                    GAME_CANVAS: 'gameCanvas',
                    GAME_UI: 'gameUI',
                    ENTER_GAME_BUTTON: 'enterGame',
                    UPGRADE_HOLDER: 'upgradeHolder',
                    UPGRADE_COUNTER: 'upgradeCounter',
                    GAME_TITLE: 'gameName',

                    // Selectors / Patterns / Classes
                    ACTION_BAR_ITEM_REGEX: /^actionBarItem(\d+)$/,
                    ACTION_BAR_ITEM_CLASS: '.actionBarItem',
                    STORE_MENU_EXPANDED_CLASS: 'expanded',
                    STORE_TAB_CLASS: 'storeTab',
                },
                CSS: {
                    DISPLAY_NONE: 'none',
                    DISPLAY_BLOCK: 'block',
                    FILTER_Equippable: 'grayscale(0) brightness(1)',
                    FILTER_Unequippable: 'grayscale(1) brightness(0.75)',
                    BORDER_NONE: 'none',
                    SELECTION_BORDER_STYLE: '2px solid white',
                    STORE_MENU_TRANSFORM: 'translateY(0px)',
                },
                GAME_STATE: {
                    INITIAL_SELECTED_ITEM_INDEX: 0,
                    WEBSOCKET_STATE_OPEN: 1, // WebSocket.OPEN
                    NO_SCROLL: 0,
                    SCROLL_DOWN: 1,
                    SCROLL_UP: -1,
                },
                TIMEOUTS: {
                    MANUAL_CODEC_SCAN: 5000,
                },
            },

            /** @property {object} _rawItems - The raw item database, grouped by category for readability before processing. */
            _rawItems: {
                PRIMARY_WEAPONS: [
                    { id: 0, server_id: 0, name: "Tool Hammer" },
                    { id: 1, server_id: 1, name: "Hand Axe" },
                    { id: 3, server_id: 3, name: "Short Sword" },
                    { id: 4, server_id: 4, name: "Katana" },
                    { id: 5, server_id: 5, name: "Polearm" },
                    { id: 6, server_id: 6, name: "Bat" },
                    { id: 7, server_id: 7, name: "Daggers" },
                    { id: 8, server_id: 8, name: "Stick" },
                    { id: 2, server_id: 2, name: "Great Axe" },
                ],
                SECONDARY_WEAPONS: [
                    { id: 9, server_id: 9, name: "Hunting Bow", cost: { wood: 4 } },
                    { id: 10, server_id: 10, name: "Great Hammer" },
                    { id: 11, server_id: 11, name: "Wooden Shield" },
                    { id: 12, server_id: 12, name: "Crossbow", cost: { wood: 5 } },
                    { id: 13, server_id: 13, name: "Repeater Crossbow", cost: { wood: 10 } },
                    { id: 14, server_id: 14, name: "MC Grabby" },
                    { id: 15, server_id: 15, name: "Musket", cost: { stone: 10 } },
                ],
                FOOD: [
                    { id: 0, server_id: 16, name: "Apple", cost: { food: 10 } },
                    { id: 1, server_id: 17, name: "Cookie", cost: { food: 15 } },
                    { id: 2, server_id: 18, name: "Cheese", cost: { food: 25 } },
                ],
                WALLS: [
                    { id: 3, server_id: 19, name: "Wood Wall", limitGroup: 1, limit: 30, cost: { wood: 10 } },
                    { id: 4, server_id: 20, name: "Stone Wall", limitGroup: 1, limit: 30, cost: { stone: 25 } },
                    { id: 5, server_id: 21, name: "Castle Wall", limitGroup: 1, limit: 30, cost: { stone: 35 } },
                ],
                SPIKES: [
                    { id: 6, server_id: 22, name: "Spikes", limitGroup: 2, limit: 15, cost: { wood: 20, stone: 5 } },
                    { id: 7, server_id: 23, name: "Greater Spikes", limitGroup: 2, limit: 15, cost: { wood: 30, stone: 10 } },
                    { id: 8, server_id: 24, name: "Poison Spikes", limitGroup: 2, limit: 15, cost: { wood: 35, stone: 15 } },
                    { id: 9, server_id: 25, name: "Spinning Spikes", limitGroup: 2, limit: 15, cost: { wood: 30, stone: 20 } },
                ],
                WINDMILLS: [
                    { id: 10, server_id: 26, name: "Windmill", limitGroup: 3, limit: 7, sandboxLimit: 299, cost: { wood: 50, stone: 10 } },
                    { id: 11, server_id: 27, name: "Faster Windmill", limitGroup: 3, limit: 7, sandboxLimit: 299, cost: { wood: 60, stone: 20 } },
                    { id: 12, server_id: 28, name: "Power Mill", limitGroup: 3, limit: 7, sandboxLimit: 299, cost: { wood: 100, stone: 50 } },
                ],
                FARMS: [
                    { id: 13, server_id: 29, name: "Mine", limitGroup: 4, limit: 1, cost: { wood: 20, stone: 100 } },
                    { id: 14, server_id: 30, name: "Sapling", limitGroup: 5, limit: 2, cost: { wood: 150 } },
                ],
                TRAPS: [
                    { id: 15, server_id: 31, name: "Pit Trap", limitGroup: 6, limit: 6, cost: { wood: 30, stone: 30 } },
                    { id: 16, server_id: 32, name: "Boost Pad", limitGroup: 7, limit: 12, sandboxLimit: 299, cost: { wood: 5, stone: 20 } },
                ],
                EXTRAS: [
                    { id: 17, server_id: 33, name: "Turret", limitGroup: 8, limit: 2, cost: { wood: 200, stone: 150 } },
                    { id: 18, server_id: 34, name: "Platform", limitGroup: 9, limit: 12, cost: { wood: 20 } },
                    { id: 19, server_id: 35, name: "Healing Pad", limitGroup: 10, limit: 4, cost: { food: 10, wood: 30 } },
                    { id: 21, server_id: 37, name: "Blocker", limitGroup: 11, limit: 3, cost: { wood: 30, stone: 25 } },
                    { id: 22, server_id: 38, name: "Teleporter", limitGroup: 12, limit: 2, sandboxLimit: 299, cost: { wood: 60, stone: 60 } },
                ],
                SPAWN_PADS: [
                    { id: 20, server_id: 36, name: "Spawn Pad", limitGroup: 13, limit: 1, cost: { wood: 100, stone: 100 } },
                ],
            },

            /** @property {object} _packetNames - Maps packet ID codes to human-readable names for logging. */
            _packetNames: {
                'A': 'All Clans List',
                'B': 'Disconnect',
                'C': 'Setup Game',
                'D': 'Add Player',
                'E': 'Remove Player',
                'G': 'Leaderboard Update',
                'H': 'Load Game Objects',
                'I': 'Update AI',
                'J': 'Animate AI',
                'K': 'Gather Animation',
                'L': 'Wiggle Game Object',
                'M': 'Shoot Turret',
                'N': 'Update Player Value',
                'O': 'Update Health',
                'P': 'Client Player Death',
                'Q': 'Kill Object',
                'R': 'Kill Objects',
                'S': 'Update Item Counts',
                'T': 'Update Age',
                'U': 'Update Upgrades',
                'V': 'Update Items',
                'X': 'Add Projectile',
                'Y': 'Remove Projectile',
                'Z': 'Server Shutdown Notice',
                'a': 'Update Players',
                'g': 'Add Alliance',
                '0': 'Ping Response',
                '1': 'Delete Alliance',
                '2': 'Alliance Notification',
                '3': 'Set Player Team',
                '4': 'Set Alliance Players',
                '5': 'Update Store Items',
                '6': 'Receive Chat',
                '7': 'Update Minimap',
                '8': 'Show Text',
                '9': 'Ping Map'
            },

            /** @property {object} _packetFormatters - Maps packet IDs to functions that format raw packet data into structured objects for easier use and logging. */
            _packetFormatters: {
                'A': ([data]) => data,
                'B': ([reason]) => ({ reason }),
                'C': ([yourSID]) => ({ yourSID }),
                'D': ([playerData, isYou]) => ({
                    id: playerData[0], sid: playerData[1], name: playerData[2], x: playerData[3], y: playerData[4],
                    dir: playerData[5], health: playerData[6], maxHealth: playerData[7], scale: playerData[8],
                    skinColor: playerData[9], isYou
                }),
                'E': ([id]) => ({ id }),
                'G': (data) => {
                    const leaderboard = [];
                    for (let i = 0; i < data.length; i += 3) leaderboard.push({ sid: data[i], name: data[i + 1], score: data[i + 2] });
                    return { leaderboard };
                },
                'H': (data) => {
                    const objects = [];
                    for (let i = 0; i < data.length; i += 8) objects.push({ sid: data[i], x: data[i+1], y: data[i+2], dir: data[i+3], scale: data[i+4], type: data[i+5], itemID: data[i+6], ownerSID: data[i+7] });
                    return { objects };
                },
                'I': (data) => {
                    const ais = [];
                    for (let i = 0; i < data.length; i += 7) ais.push({ sid: data[i], index: data[i+1], x: data[i+2], y: data[i+3], dir: data[i+4], health: data[i+5], nameIndex: data[i+6] });
                    return { ais };
                },
                'J': ([sid]) => ({ sid }),
                'K': ([sid, didHit, index]) => ({ sid, didHit, weaponIndex: index }),
                'L': ([dir, sid]) => ({ dir, sid }),
                'M': ([sid, dir]) => ({ sid, dir }),
                'N': ([propertyName, value, updateView]) => ({ propertyName, value, updateView }),
                'O': ([sid, newHealth]) => ({ sid, newHealth }),
                'P': () => ({}),
                'Q': ([sid]) => ({ sid }),
                'R': ([sid]) => ({ sid }),
                'S': ([groupID, count]) => ({ groupID, count }),
                'T': ([xp, maxXP, age]) => ({ xp, maxXP, age }),
                'U': ([points, age]) => ({ points, age }),
                'V': ([items, isWeaponList]) => ({ items, isWeaponList }),
                'X': ([x, y, dir, range, speed, index, layer, sid]) => ({ x, y, dir, range, speed, index, layer, sid }),
                'Y': ([sid, newRange]) => ({ sid, newRange }),
                'Z': ([countdown]) => ({ countdown }),
                'a': (data) => {
                    const players = [];
                    for (let i = 0; i < data.length; i += 13) players.push({ sid: data[i], x: data[i+1], y: data[i+2], dir: data[i+3], buildIndex: data[i+4], weaponIndex: data[i+5], weaponVariant: data[i+6], team: data[i+7], isLeader: data[i+8], skinIndex: data[i+9], tailIndex: data[i+10], iconIndex: data[i+11], zIndex: data[i+12] });
                    return { players };
                },
                'g': ([clanData]) => ({ newClan: clanData }),
                '0': () => ({}),
                '1': ([sid]) => ({ sid }),
                '2': ([sid, name]) => ({ sid, name }),
                '3': ([team, isOwner]) => ({ team, isOwner }),
                '4': (data) => {
                    const members = [];
                    for (let i = 0; i < data.length; i += 2) members.push({ sid: data[i], name: data[i+1] });
                    return { members };
                },
                '5': ([itemType, itemID, action]) => ({ itemType: itemType === 0 ? this.data.constants.PACKET_DATA.WEARABLE_TYPES.HAT : this.data.constants.PACKET_DATA.WEARABLE_TYPES.ACCESSORY, itemID, action: action === 0 ? this.data.constants.PACKET_DATA.STORE_ACTIONS.ADD_ITEM : this.data.constants.PACKET_DATA.STORE_ACTIONS.UPDATE_EQUIPPED }),
                '6': ([sid, message]) => ({ sid, message }),
                '7': (data) => ({ minimapData: data }),
                '8': ([x, y, value, type]) => ({ x, y, value, type }),
                '9': ([x, y]) => ({ x, y })
            },

            /**
             * Processes the raw item data from `_rawItems` into the lookup maps for efficient access.
             * This function is called once during the script's initialization.
             * @function
             */
            initialize() {
                const C = this.constants;
                const itemTypes = {
                    FOOD:              { slot: 0, itemType: C.ITEM_TYPES.FOOD },
                    WALLS:             { slot: 1, itemType: C.ITEM_TYPES.WALL },
                    SPIKES:            { slot: 2, itemType: C.ITEM_TYPES.SPIKE },
                    WINDMILLS:         { slot: 3, itemType: C.ITEM_TYPES.WINDMILL },
                    FARMS:             { slot: 6, itemType: C.ITEM_TYPES.FARM },
                    TRAPS:             { slot: 4, itemType: C.ITEM_TYPES.TRAP },
                    EXTRAS:            { slot: 5, itemType: C.ITEM_TYPES.EXTRA },
                    SPAWN_PADS:        { slot: 7, itemType: C.ITEM_TYPES.SPAWN_PAD },
                    PRIMARY_WEAPONS:   { slot: 8, itemType: C.ITEM_TYPES.PRIMARY_WEAPON },
                    SECONDARY_WEAPONS: { slot: 9, itemType: C.ITEM_TYPES.SECONDARY_WEAPON },
                };

                for (const category in this._rawItems) {
                    const { itemType, slot } = itemTypes[category];
                    this._rawItems[category].forEach(item => {
                        const fullItemData = {
                            ...item,

                            itemType,
                            slot,
                            cost: {
                                food: 0,
                                wood: 0,
                                stone: 0,
                                gold: 0,

                                ...item.cost
                            }
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

        // --- PUBLIC UTILITY FUNCTIONS ---

        /**
         * Extracts the server-side item ID from a DOM element's ID attribute.
         * @param {HTMLElement} itemElem - The action bar item element.
         * @returns {RegExpMatchArray|null} A match array where index 1 is the ID, or null if no match.
         */
        getItemIdFromElem(itemElem) {
            return itemElem.id.match(this.data.constants.DOM.ACTION_BAR_ITEM_REGEX);
        },

        /**
         * Retrieves the full data object for an item from its corresponding DOM element.
         * @param {HTMLElement} itemElem - The action bar item element.
         * @returns {object|undefined} The item data object, or undefined if not found.
         */
        getItemFromElem(itemElem) {
            const match = this.getItemIdFromElem(itemElem);
            if (!match) return undefined;

            const serverItemId = parseInt(match[1]);
            return this.data._itemDataByServerId.get(serverItemId);
        },

        /**
         * Checks if the player has sufficient resources to afford an item.
         * @param {object} itemData - The item's data object, containing a `cost` property.
         * @returns {boolean} True if the item is affordable or has no cost, false otherwise.
         */
        isAffordableItem(itemData) {
            if (!itemData || !itemData.cost) return true; // Free items are always affordable

            return this.state.playerResources.food >= itemData.cost.food &&
                   this.state.playerResources.wood >= itemData.cost.wood &&
                   this.state.playerResources.stone >= itemData.cost.stone;
        },

        /**
         * Checks if an item element in the action bar is currently visible and represents a valid item.
         * @param {HTMLElement} itemElem - The action bar item element.
         * @returns {boolean} True if the item is available for selection.
         */
        isAvailableItem(itemElem) {
            const isVisible = itemElem.style.display !== this.data.constants.CSS.DISPLAY_NONE;
            if (!isVisible) return false;

            return !!this.getItemIdFromElem(itemElem);
        },

        /**
         * Determines if an item can be equipped by checking its availability, affordability, and placement limits.
         * @param {HTMLElement} itemElem - The action bar item element.
         * @returns {boolean} True if the item can be equipped.
         */
        isEquippableItem(itemElem) {
            if (!this.isAvailableItem(itemElem)) return false;

            const itemData = this.getItemFromElem(itemElem);
            if (!itemData) return false;

            // Check 1: Resource affordability
            if (!this.isAffordableItem(itemData)) return false;

            // Check 2: Placement limit
            if (itemData.limitGroup) {
                const limit = this.state.isSandbox && itemData.sandboxLimit ? itemData.sandboxLimit : itemData.limit;
                const currentCount = this.state.playerPlacedItemCounts.get(itemData.limitGroup) || 0;

                if (currentCount >= limit) return false;
            }

            return true; // If both checks pass
        },

        /**
         * Observes a specific HTMLElement and resolves a promise once its computed
         * style property 'display' stops being 'none'.
         *
         * @param {HTMLElement} element The HTML element to observe.
         * @returns {Promise<HTMLElement>} A promise that resolves with the element itself
         *   once its display is 'block'. Rejects if the input is not an HTMLElement.
         */
        waitForVisible(element) {
            if (!element) return Promise.reject();

            // Define the condition check in one place to avoid repetition.
            const isDisplayBlock = () => window.getComputedStyle(element).display !== 'none';

            // Handle the common case: If the element is already visible, resolve immediately.
            if (isDisplayBlock()) return Promise.resolve(element);

            // If not visible, return a promise that sets up the observer.
            return new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    // When any mutation occurs, re-run the check.
                    if (isDisplayBlock()) {
                        // Once the condition is met, clean up and resolve the promise.
                        observer.disconnect();
                        resolve(element);
                    }
                });

                // Start observing the specific element for attribute changes
                observer.observe(element, { attributes: true });
            });
        },

        // --- CORE INTERNAL FUNCTIONS ---

        /**
         * Encodes and sends a packet to the game server via WebSocket.
         * It safely handles the encoding and ensures the socket is ready before attempting to send.
         *
         * @param {string} type - The one-character identifier for the packet type (e.g; 'z' for equip, 'c' for wearable).
         * @param {any[]} data - The payload/data for the packet, typically an array of arguments.
         */
        sendGamePacket(type, data) {
            try {
                if (this.state.gameSocket && this.state.gameSocket.readyState === this.data.constants.GAME_STATE.WEBSOCKET_STATE_OPEN) {
                    this.state.gameSocket.send(this.state.gameEncoder.encode([type, data]));
                }
            } catch (err) {
                Logger.error(`Failed to send packet [${type}]`, err);
            }
        },

        /**
         * Intercepts and processes incoming WebSocket messages to track game state changes.
         * @param {MessageEvent} event - The WebSocket message event containing the game data.
         */
        handleSocketMessage(event) {
            if (!this.state.gameDecoder) return Logger.error("Game Decoder was not stored.", event, this);
            try {
                const [packetID, ...argsArr] = this.state.gameDecoder.decode(new Uint8Array(event.data));
                const args = argsArr[0]; // The game nests args in another array for some reason
                const packetName = this.data._packetNames[packetID] || 'Unknown Packet';
                const packetData = this.data._packetFormatters[packetID] ? this.data._packetFormatters[packetID](args) : { rawData: args };

                // Dispatch the packet to all minimods
                this.miniMods.forEach(mod => {
                    if (typeof mod.onPacket === 'function') {
                        mod.onPacket(packetName, packetData, args);
                    }
                });

                switch (packetName) {
                    case 'Client Player Death': {
                        if (this.state.playerHasRespawned); // Do nothing
                        else this.state.playerHasRespawned = true

                        break;
                    }
                }

                if (this.config.DEBUG_MODE) {
                    // --- Log Every Packet ---

                    /* Ignore List (mostly due to spam):
                    {
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

                    // These four periodically spam, very quickly too.
                    const ignoredPackets = ['I', 'a', '0', '7', 'Z'];
                    // Some of these are period, some aren't, all are very frequent.
                    // const ignoredPackets = ['I', 'a', '0', '7', 'Z', 'H', 'G', 'K', 'L', 'T'];
                    if (ignoredPackets.includes(packetID.toString())) return;
                    // Other people get hurt / heal around you quite often, it's a little annoying:
                    // if (packetID.toString() === 'O' && packetData.playerID !== this.state.playerId) return;

                    const dataString = Object.keys(packetData).length > 0 ? JSON.stringify(packetData) : '{}';
                    Logger.log(`Packet: ${packetName} (${packetID}) -> ${dataString}`, args);
                }
            } catch (e) { /* Ignore decoding errors for packets we don't care about */ }
        },

        // --- INITIALIZATION & HOOKING ---

        /**
         * Collects CSS from the core mod and all registered mini-mods and injects it into a single style tag.
         */
        injectCSS() {
            const allCSS = [];

            // Add core CSS
            const coreCSS = this.applyCoreCSS().trim();
            if (coreCSS) {
                allCSS.push('/* --- Injecting Core Mod CSS --- */\n' + coreCSS);
            }

            // Add minimod CSS
            this.miniMods.forEach(mod => {
                if (mod && typeof mod.applyCSS === 'function') {
                    const modCSS = mod.applyCSS().trim();
                    if (modCSS) {
                        allCSS.push('/* --- Injecting "' + (mod.name || 'Unnamed Mod') + '" MiniMod CSS --- */\n' + modCSS);
                }
                }
            });

            if (allCSS.length > 0) {
                const style = document.createElement('style');
                style.textContent = allCSS.join('\n\n/* --- CSS Separator --- */\n\n');
                document.head.append(style);
                Logger.log(`Injected CSS from core and ${this.miniMods.filter(m => typeof m.applyCSS === 'function' && m.applyCSS().trim()).length} mini-mod(s).`, "color: #4CAF50;");
            } else {
                Logger.log("No CSS to inject.");
            }
        },

        /**
         * Returns the CSS styles for the core mod, such as the title screen enhancement.
         * @returns {string} The CSS string.
         */
        applyCoreCSS() {
            return `
                #${this.data.constants.DOM.GAME_TITLE} {
                    --text-shadow-colour: oklch(from currentColor calc(l * 0.82) c h);
                    text-shadow: 0 1px 0 var(--text-shadow-colour),   0 2px 0 var(--text-shadow-colour),   0 3px 0 var(--text-shadow-colour),   0 4px 0 var(--text-shadow-colour),   0 5px 0 var(--text-shadow-colour),   0 6px 0 var(--text-shadow-colour),   0 7px 0 var(--text-shadow-colour),   0 8px 0 var(--text-shadow-colour),   0 9px 0 var(--text-shadow-colour);
                }
                #${this.data.constants.DOM.GAME_TITLE} > span {
                    color: #fbeec9;
                }
            `;
        },

        /**
         * Updates the main menu title screen with custom styling.
         */
        updateGameTitleScreen() {
            const targetNode = document.body;
            const config = { childList: true, subtree: true };

            const updateTitle = () => {
                const titleElem = document.getElementById(this.data.constants.DOM.GAME_TITLE);
                if (titleElem) {
                    titleElem.innerHTML = `MOOMOO<span>.</span>io`;
                    Logger.log("Updated game title screen.", "color: #4CAF50;");
                    return true; // Indicate success
                }
                return false; // Indicate failure
            };

            // First, try to update immediately in case the element already exists.
            if (updateTitle()) return; // Job done

            // If it doesn't exist, set up the observer to watch for it.
            const observer = new MutationObserver((mutationsList, obs) => {
                // We only need to find it once, when found & updated, stop updating.
                if (updateTitle()) obs.disconnect();
            });

            // Start observing the target node for configured mutations.
            observer.observe(targetNode, config);
        },

        /**
         * Finds the game's msgpack encoder/decoder instances by hooking into Object.prototype.
         * It temporarily redefines a property setter on Object.prototype. When the game's code
         * creates an object with a specific property (like 'initialBufferSize'), our setter
         * fires, allowing us to grab a reference to that object.
         * @param {string} propName - The unique property name to watch for.
         * @param {Function} onFound - The callback to execute when the object is found.
         */
        hookIntoPrototype(propName, onFound) {
            Logger.log(`Setting up prototype hook for: ${propName}`);
            const originalDesc = Object.getOwnPropertyDescriptor(Object.prototype, propName);

            Object.defineProperty(Object.prototype, propName, {
                set(value) {
                    // Restore the prototype to its original state *before* doing anything else.
                    // This prevents unexpected side effects and race conditions within the hook itself.
                    if (originalDesc) {
                        Object.defineProperty(Object.prototype, propName, originalDesc);
                    } else {
                        delete Object.prototype[propName];
                    }

                    // Now, apply the value to the current instance.
                    this[propName] = value;

                    // Check if this is the object we are looking for and trigger the callback.
                    // We check for the function's existence to be more certain.
                    if ((propName === "initialBufferSize" && typeof this.encode === 'function') ||
                        (propName === "maxExtLength" && typeof this.decode === 'function')) {
                        Logger.log(`Hook successful for "${propName}". Object found.`, "color: #4CAF50;");
                        onFound(this);
                    }
                },
                configurable: true,
            });
        },

        /**
         * Manually scans the window object to find the game's encoder and decoder.
         * This is a fallback mechanism in case the prototype hooks fail.
         * @param {Function} onSuccessCallback - The function to call if both codecs are found.
         */
        findCodecsManually(onSuccessCallback) {
            Logger.warn("Prototype hooks failed or timed out. Initiating manual scan...");

            const MAX_SEARCH_DEPTH = 5;
            const visited = new Set(); // To avoid infinite loops in circular objects

            const scanObject = (obj, depth) => {
                // Stop conditions for recursion
                if (depth > MAX_SEARCH_DEPTH || !obj || visited.has(obj) || (this.state.gameEncoder && this.state.gameDecoder)) {
                    return;
                }
                visited.add(obj);

                for (const key in obj) {
                    try {
                        const prop = obj[key];
                        if (!prop || typeof prop !== 'object') continue;

                        // Heuristic 1: Look for the msgpack encoder
                        if (!this.state.gameEncoder && prop.initialBufferSize !== undefined && typeof prop.encode === 'function') {
                            Logger.log("Manual scan found the ENCODER.", "color: #4CAF50;");
                            this.state.gameEncoder = prop;
                        }

                        // Heuristic 2: Look for the msgpack decoder
                        if (!this.state.gameDecoder && prop.maxExtLength !== undefined && typeof prop.decode === 'function') {
                            Logger.log("Manual scan found the DECODER.", "color: #4CAF50;");
                            this.state.gameDecoder = prop;
                        }

                        // If we found both, stop scanning this branch
                        if (this.state.gameEncoder && this.state.gameDecoder) {
                            return;
                        }

                        // Recurse into the nested object
                        scanObject(prop, depth + 1);

                    } catch (e) {
                        // Ignore errors from accessing certain properties
                    }
                }
            };

            scanObject(window, 0);

            if (this.state.gameEncoder && this.state.gameDecoder) {
                Logger.log("Manual scan succeeded.", "color: #4CAF50;");
                onSuccessCallback(); // Trigger the final setup
            } else {
                Logger.error("Manual scan failed to find one or both msgpack codecs. The script may not function correctly.");
            }
        },

        /**
         * Sets up all necessary hooks to integrate with the game's internal objects and network traffic.
         * This new logic ensures that message listeners are only attached *after* codecs are confirmed to be found.
         */
        initializeHooks() {
            const C = this.data.constants;

            // This is the single, centralized function that attaches all critical event listeners
            // once we are sure the codecs have been found.
            const onCodecsReady = () => {
                if (this.state.isListenerActive) return; // Prevent this from running more than once

                Logger.log("Both msgpack codecs found. Attaching all listeners.", "color: #ffb700;");

                // 1. Attach the core packet handler to the captured WebSocket instance
                if (this.state.gameSocket) {
                    this.state.gameSocket.addEventListener('message', this.handleSocketMessage.bind(this));
                } else {
                    // This should theoretically never happen if the WS hook works, but it's good practice to check.
                    return Logger.error("Codecs found, but the game WebSocket was not captured! Cannot process packets.");
                }

                // 2. Attach all minimod-specific event listeners (e.g., wheel, keydown)
                this.miniMods.forEach(mod => {
                    if (typeof mod.addEventListeners === 'function') mod.addEventListeners();
                });

                this.state.isListenerActive = true;
            };


            // Hook 1: Find msgpack codecs via prototype mutation (the fast, preferred path)
            let codecsFoundByHook = 0;
            const onCodecFoundByHook = () => {
                codecsFoundByHook++;
                if (codecsFoundByHook === 2) {
                    onCodecsReady();
                }
            };

            this.hookIntoPrototype("initialBufferSize", (obj) => { this.state.gameEncoder = obj; onCodecFoundByHook(); });
            this.hookIntoPrototype("maxExtLength", (obj) => { this.state.gameDecoder = obj; onCodecFoundByHook(); });


            // Hook 2: Intercept WebSocket creation to get a reference to the game's socket instance.
            const originalWebSocket = window.WebSocket;
            window.WebSocket = new Proxy(originalWebSocket, {
                construct: (target, args) => {
                    const wsInstance = new target(...args);
                    this.state.gameSocket = wsInstance;
                    Logger.log("Game WebSocket instance captured.");

                    // Restore the original WebSocket constructor immediately after capturing the first instance.
                    window.WebSocket = originalWebSocket;
                    return wsInstance;
                }
            });


            // Fallback Trigger: If the prototype hooks haven't found the codecs after a delay,
            // assume they failed and initiate the manual scan.
            setTimeout(() => {
                if (!this.state.isListenerActive) {
                    this.findCodecsManually(onCodecsReady); // Pass the final setup callback
                }
            }, C.TIMEOUTS.MANUAL_CODEC_SCAN);
        },

        /**
         * Runs once the WebSocket is established and the player has spawned.
         * Performs initial setup that requires the DOM to be populated, like UI tweaks and scraping initial resources.
         */
        onGameReady() {
            try {
                // Notify minimods that the game is ready
                this.miniMods.forEach(mod => {
                    if (typeof mod.onGameReady === 'function') mod.onGameReady();
                });
            } catch(e) {
                Logger.error("Failed during onGameReady setup.", e);
            }
        },

        /**
         * The main entry point for the script. Initializes data and sets up hooks.
         */
        init() {
            Logger.log("--- MOOMOO.IO Utility Mod Initializing ---", "color: #ffb700; font-weight: bold;");

            this.data.initialize();
            this.initializeHooks();

            // Inject styles immediately, as document.head is available early.
            this.injectCSS();

            // Wait for the body to load before trying to modify its elements.
            this.updateGameTitleScreen();

            this.miniMods.forEach(mod => {
                if (typeof mod.init === 'function') {
                    Logger.log(`Initializing minimod: ${mod.name || 'Unnamed Mod'}`);
                    try {
                        mod.init();
                    } catch (e) {
                        Logger.error(`Error during init of ${mod.name || 'Unnamed Mod'}:`, e);
                    }
                }
            });

            // Exposes the core to the global window object for debugging purposes.
            window.MooMooUtilityMod = this;
        },

        // --- MINI-MOD MANAGEMENT ---

        /** @property {Array<object>} miniMods - A list of all registered sub-modules. */
        miniMods: [],

        /**
         * Adds a mini-mod to the system to be initialized.
         * @param {object} mod - The mini-mod object to register.
         */
        registerMod(mod) {
            this.miniMods.push(mod);
            mod.core = this; // Give the minimod a reference to the core

            Logger.log(`Registered minimod: ${mod.name || 'Unnamed Mod'}`);
        }
    };

    /**
     * @module ScrollInventoryMiniMod
     * @description A minimod for Minecraft-style inventory selection with the scroll wheel and hotkeys.
     */
    const ScrollInventoryMiniMod = {

        // --- MINI-MOD PROPERTIES ---

        /** @property {object|null} core - A reference to the core module object, set upon registration. */
        core: null,

        /** @property {string} name - The display name of the minimod. */
        name: "Scroll Wheel Inventory",

        /** @property {object} constants - Constants specific to this minimod. */
        constants: {
            HOTKEYS: {
                USE_FOOD: 'Q',
            },
        },

        /** @property {object} state - Dynamic state for this minimod. */
        state: {
            /** @property {number} selectedItemIndex - The current index within the list of *equippable* items. */
            selectedItemIndex: -1,
            /** @property {number} lastSelectedWeaponIndex - The index of the last selected weapon, used to auto-switch back after using an item. */
            lastSelectedWeaponIndex: -1,
        },

        // --- MINI-MOD LIFECYCLE & HOOKS ---

        /**
         * Handles incoming game packets and updates the state of the Scroll Inventory Mini-mod.
         * This function acts as a central dispatcher for various packet types relevant to inventory management.
         *
         * @param {string} packetName - The human-readable name of the incoming packet.
         * @param {object} packetData - The parsed data object from the incoming packet.
         */
        onPacket(packetName, packetData) {
            switch (packetName) {
                case 'Setup Game': {
                    // Stores the client's player ID upon initial connection.
                    this.core.state.playerId = packetData.yourSID;
                    break;
                }

                case 'Add Player': {
                    // When the client player spawns, trigger the core's onGameReady to finalize setup.
                    if (this.core.state.playerId === packetData.sid && packetData.isYou) {
                        this.core.onGameReady();
                    }
                    break;
                }

                case 'Update Player Value': {
                    // Updates player resource counts and refreshes equippable item states.
                    // If a non-gold resource decreases, assume item usage and try to revert to the last selected weapon.
                    const resourceType = packetData.propertyName;
                    const oldAmount = this.core.state.playerResources[resourceType];
                    this.core.state.playerResources[resourceType] = packetData.value;

                    if (resourceType !== 'points' && packetData.value < oldAmount) {
                        this.state.selectedItemIndex = this.state.lastSelectedWeaponIndex;
                    }

                    this.refreshEquippableState();
                    break;
                }

                case 'Update Item Counts': {
                    // Updates the count of placed items (e.g; walls, traps) and refreshes equippable states.
                    // This is crucial for enforcing placement limits.
                    const itemData = this.core.data._itemDataByServerId.get(packetData.groupID);
                    if (itemData && itemData.limitGroup) {
                        this.core.state.playerPlacedItemCounts.set(itemData.limitGroup, packetData.count);
                        this.refreshEquippableState();
                    }
                    break;
                }
            }
        },

        /**
         * Adds necessary event listeners to the document and action bar for inventory interaction.
         */
        addEventListeners() {
            const C = this.core.data.constants;
            document.addEventListener('wheel', this.handleInventoryScroll.bind(this), { passive: false });
            document.addEventListener('keydown', this.handleKeyPress.bind(this));
            document.getElementById(C.DOM.ACTION_BAR).addEventListener('click', this.handleItemClick.bind(this));
        },

        /**
         * Called when the game is ready. Selects the initial weapon and sets up UI observers.
         */
        onGameReady() {
            const C = this.core.data.constants;

            // Wait for Game UI to load before proceeding
            const gameUI = document.getElementById(C.DOM.GAME_UI);
            this.core.waitForVisible(gameUI).then(() => {
                // --- Scrape initial state from the DOM ---
                const resElements = document.getElementById(C.DOM.RESOURCE_DISPLAY).children;
                this.core.state.playerResources = {
                    food: parseInt(resElements[0].textContent) || 0,
                    wood: parseInt(resElements[1].textContent) || 0,
                    stone: parseInt(resElements[2].textContent) || 0,
                    gold: parseInt(resElements[3].textContent) || 0,
                };

                // --- Perform initial actions ---
                this.selectItemByIndex(C.GAME_STATE.INITIAL_SELECTED_ITEM_INDEX);
            });
        },

        // --- EVENT HANDLERS ---

        /**
         * The main handler for the 'wheel' event. Orchestrates item selection on scroll.
         * @param {WheelEvent} event - The DOM wheel event.
         */
        handleInventoryScroll(event) {
            const C = this.core.data.constants;
            if (this._isInputFocused() || !this.core.state.gameSocket || this.core.state.gameSocket.readyState !== C.GAME_STATE.WEBSOCKET_STATE_OPEN) return;

            event.preventDefault();

            // Determine scroll direction and send to refresh selection UI function.
            const scrollDirection = event.deltaY > 0 ? C.GAME_STATE.SCROLL_DOWN : C.GAME_STATE.SCROLL_UP;
            this.refreshEquippableState(scrollDirection);
        },

        /**
         * Handles keyboard shortcuts for direct item selection (e.g; '1'-'9', 'Q').
         * @param {KeyboardEvent} event - The DOM keyboard event.
         */
        handleKeyPress(event) {
            if (this._isInputFocused()) return;

            const C = this.core.data.constants;
            const pressedKey = event.key.toUpperCase();

            const actionBar = document.getElementById(C.DOM.ACTION_BAR);
            if (!actionBar) return;

            const availableItems = Array.from(actionBar.children).filter(el => this.core.isAvailableItem(el));
            if (availableItems.length === 0) return;

            const isNumericHotkey = (key) => key >= '1' && key <= '9';
            const isFoodHotkey = (key) => key === this.constants.HOTKEYS.USE_FOOD;
            const findFoodItem = (items) => items.find(el => this.core.getItemFromElem(el)?.itemType === C.ITEM_TYPES.FOOD);

            let targetElement = null;
            if (isNumericHotkey(pressedKey)) {
                targetElement = availableItems[parseInt(pressedKey) - 1];
            } else if (isFoodHotkey(pressedKey)) {
                targetElement = findFoodItem(availableItems);
            }

            if (targetElement && this.core.isEquippableItem(targetElement)) {
                const equippableItems = Array.from(actionBar.children).filter(el => this.core.isEquippableItem(el));
                const newIndex = equippableItems.findIndex(el => el.id === targetElement.id);
                if (newIndex !== -1) this.selectItemByIndex(newIndex);
            }
        },

        /**
         * Handles direct item selection by clicking on the action bar.
         * @param {MouseEvent} event - The DOM mouse event.
         */
        handleItemClick(event) {
            if (this._isInputFocused()) return;
            const C = this.core.data.constants;
            const clickedElement = event.target.closest(C.DOM.ACTION_BAR_ITEM_CLASS);
            if (clickedElement && this.core.isEquippableItem(clickedElement)) {
                const actionBar = document.getElementById(C.DOM.ACTION_BAR);
                if (!actionBar) return;
                const equippableItems = Array.from(actionBar.children).filter(el => this.core.isEquippableItem(el));
                const newIndex = equippableItems.findIndex(el => el.id === clickedElement.id);
                if (newIndex !== -1) this.selectItemByIndex(newIndex);
            }
        },

        // --- CORE LOGIC & UI MANIPULATION ---

        /**
         * The master function for refreshing the inventory selection state and UI.
         * @param {number} [scrollDirection=0] - The direction of scroll. 1 for down, -1 for up. 0 refreshes UI without changing selection.
         */
        refreshEquippableState(scrollDirection = this.core.data.constants.GAME_STATE.NO_SCROLL) {
            const C = this.core.data.constants;
            const actionBar = document.getElementById(C.DOM.ACTION_BAR);
            if (!actionBar) return;

            const equippableItems = Array.from(actionBar.children).filter(el => this.core.isEquippableItem(el));
            if (equippableItems.length === 0) {
                Logger.warn("No equippable items available.");
                this.state.selectedItemIndex = -1;
                this.updateSelectionUI(null);
                return;
            }

            // Calculate new index, handling scrolling and list changes.
            this.state.selectedItemIndex = (this.state.selectedItemIndex + scrollDirection + equippableItems.length) % equippableItems.length;

            // Store the last active weapon's index.
            if (equippableItems[1]) {
                const secondEquippableItem = this.core.getItemFromElem(equippableItems[1]);
                if (this.state.selectedItemIndex <= C.ITEM_TYPES.SECONDARY_WEAPON) {
                    const isSingleWielder = secondEquippableItem?.itemType > C.ITEM_TYPES.SECONDARY_WEAPON;
                    this.state.lastSelectedWeaponIndex = isSingleWielder ? C.ITEM_TYPES.PRIMARY_WEAPON : this.state.selectedItemIndex;
                }
            }

            const selectedElement = equippableItems[this.state.selectedItemIndex];
            if (!selectedElement) return;

            // If we scrolled, send the equip packet.
            if (scrollDirection !== C.GAME_STATE.NO_SCROLL) {
                const itemToEquip = this.core.getItemFromElem(selectedElement);
                if (itemToEquip) {
                    const isWeapon = itemToEquip.itemType <= C.ITEM_TYPES.SECONDARY_WEAPON;
                    this.core.sendGamePacket(C.PACKET_TYPES.EQUIP_ITEM, [itemToEquip.id, isWeapon]);
                }
            }

            this.updateSelectionUI(selectedElement);
        },

        /**
         * Updates state when an item is selected by its index in the list of equippable items.
         * @param {number} newIndex - The index of the item to select in the list of currently equippable items.
         */
        selectItemByIndex(newIndex) {
            const C = this.core.data.constants;
            const actionBar = document.getElementById(C.DOM.ACTION_BAR);
            if (!actionBar) return;

            const equippableItems = Array.from(actionBar.children).filter(el => this.core.isEquippableItem(el));
            if (newIndex < 0 || newIndex >= equippableItems.length) return;

            this.state.selectedItemIndex = newIndex;
            this.refreshEquippableState(C.GAME_STATE.NO_SCROLL);
        },

        // --- UI & HELPER FUNCTIONS ---

        /**
         * Updates the action bar UI to highlight the selected item and apply styles to others.
         * @param {HTMLElement|null} selectedItem - The element to highlight as selected.
         */
        updateSelectionUI(selectedItem) {
            const C = this.core.data.constants;
            const actionBar = document.getElementById(C.DOM.ACTION_BAR);
            if (!actionBar) return;

            const allItems = Array.from(actionBar.children);
            allItems.forEach(item => {
                item.style.border = item === selectedItem ? C.CSS.SELECTION_BORDER_STYLE : C.CSS.BORDER_NONE;
                item.style.filter = this.core.isEquippableItem(item) ? C.CSS.FILTER_Equippable : C.CSS.FILTER_Unequippable;
            });
        },

        /**
         * Checks if a user input element (like chat or menus) is currently focused.
         * @private
         * @returns {boolean} True if an input is focused, false otherwise.
         */
        _isInputFocused() {
            const C = this.core.data.constants;
            const isVisible = (id) => {
                const elem = document.getElementById(id);
                return elem && elem.style.display === C.CSS.DISPLAY_BLOCK;
            };
            return isVisible(C.DOM.CHAT_HOLDER) || isVisible(C.DOM.STORE_MENU) || isVisible(C.DOM.ALLIANCE_MENU);
        },
    };

    /**
     * @module WearablesToolbarMiniMod
     * @description A minimod that adds a clickable, draggable hotbar for equipping wearables (hats & accessories).
     */
    const WearablesToolbarMiniMod = {

        // --- MINI-MOD PROPERTIES ---

        /** @property {object|null} core - A reference to the core module object, set upon registration. */
        core: null,

        /** @property {string} name - The display name of the minimod. */
        name: "Wearables Toolbar",

        /** @property {object} config - Holds user-configurable settings and CSS for the script. */
        config: {
        },

        /** @property {object} constants - Constants specific to this minimod. */
        constants: {
            HOTKEYS: {
                TOGGLE_WEARABLES: 'P',
            },
            TEXT: {
                PIN: 'Pin',
                UNPIN: 'Unpin',
                EQUIP_BUTTON_TEXT: 'equip',
            },
            DOM: {
                ITEM_INFO_HOLDER: 'itemInfoHolder',
                WEARABLES_TOOLBAR: 'wearablesToolbar',
                WEARABLES_HATS: 'wearablesHats',
                WEARABLES_ACCESSORIES: 'wearablesAccessories',
                WEARABLES_GRID_CLASS: 'wearables-grid',
                WEARABLE_BUTTON_CLASS: 'wearable-btn',
                WEARABLE_BUTTON_ID_PREFIX: 'wearable-btn-',
                JOIN_ALLIANCE_BUTTON_CLASS: 'joinAlBtn',
                PIN_BUTTON_CLASS: 'pinBtn',
                WEARABLE_SELECTED_CLASS: 'selected',
                WEARABLE_DRAGGING_CLASS: 'dragging'
            },
            CSS: {
                DRAGGING_OPACITY: '0.5',
            },
            REGEX: {
                HAT_IMG: /hat_(\d+)\.png/,
                ACCESSORY_IMG: /access_(\d+)\.png/,
            },
            URLS: {
                BASE_IMG: 'https://moomoo.io/img',
                HAT_IMG_PATH: '/hats/hat_',
                ACCESSORY_IMG_PATH: '/accessories/access_',
                IMG_EXT: '.png',
            },
            TIMEOUTS: {
                DRAG_AND_DROP_VISIBILITY: 0,
            },
        },

        /** @property {object} state - Dynamic state for this minimod. */
        state: {
            /** @property {boolean} isVisible - Whether the toolbar UI is currently shown. */
            isVisible: true,
            /** @property {Set<number>} pinnedWearables - A set of wearable IDs that the user has pinned to the toolbar. */
            pinnedWearables: new Set(),
            /** @property {HTMLElement|null} draggedItem - The wearable button element currently being dragged. */
            draggedItem: null,
        },

        // --- MINI-MOD LIFECYCLE & HOOKS ---

        /**
         * Returns the CSS rules required for styling the wearables toolbar and its buttons.
         * @returns {string} The CSS string.
         */
        applyCSS() {
            return `
                #${this.core.data.constants.DOM.STORE_MENU} {
                    top: 20px;
                    height: calc(100% - 240px);

                    --extended-width: 80px;

                    .${this.core.data.constants.DOM.STORE_TAB_CLASS} {
                        padding: 10px calc(10px + (var(--extended-width) / 4));
                    }

                    #${this.core.data.constants.DOM.STORE_HOLDER} {
                        height: 100%;
                        width: calc(400px + var(--extended-width));
                    }

                    &.${this.core.data.constants.DOM.STORE_MENU_EXPANDED_CLASS} {
                        top: 140px;
                        height: calc(100% - 360px);
                    }
                }

                .${this.constants.DOM.PIN_BUTTON_CLASS} {
                    --text-color: hsl(from #80eefc calc(h + 215) s l);
                    color: var(--text-color);
                    padding-right: 5px;

                    &:hover {
                        color: hsl(from var(--text-color) h calc(s * 0.5) calc(l * 0.75));
                    }
                }

                #${this.constants.DOM.ITEM_INFO_HOLDER} {
                    top: calc(20px + var(--top-offset, 0px));
                }

                #${this.constants.DOM.WEARABLES_TOOLBAR} {
                    position: absolute;
                    left: 20px;
                    top: 20px;
                    padding: 7px 10px 5px;
                    width: auto;
                    max-width: 440px;
                    background-color: rgba(0, 0, 0, 0.25);
                    border-radius: 3px;
                    pointer-events: all;
                    
                    & > h1 {
                        margin: 0;
                        color: #fff;
                        font-size: 31px;
                        font-weight: inherit;

                        & > span {
                            font-size: 0.5em;
                            vertical-align: middle;
                        }
                    }
                }

                .${this.constants.DOM.WEARABLES_GRID_CLASS} {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: flex-start;
                }

                .${this.constants.DOM.WEARABLE_BUTTON_CLASS} {
                    width: 40px;
                    height: 40px;
                    margin: 4px 0;
                    border: 2px solid rgba(255, 255, 255, 0.25);
                    background-size: contain;
                    background-position: center;
                    background-repeat: no-repeat;
                    cursor: pointer;
                    background-color: rgba(0, 0, 0, 0.125);
                    border-radius: 4px;
                    transition: all 0.2s ease;

                    &:hover {
                        background-color: rgba(255, 255, 255, 0.125);
                        border-color: white;
                    }

                    &.${this.constants.DOM.WEARABLE_SELECTED_CLASS} {
                        background-color: #5b9c52;
                        border-color: lightgreen;
                        box-shadow: 0 0 8px lightgreen;
                    }
                }

                .${this.constants.DOM.WEARABLE_BUTTON_CLASS}.${this.constants.DOM.WEARABLE_DRAGGING_CLASS} {
                    opacity: ${this.constants.CSS.DRAGGING_OPACITY};
                }
            `
        },

        // --- MINI-MOD LIFECYCLE & HOOKS ---

        /**
         * Handles incoming game packets related to the Store / Shop and updates the Wearables Toolbar UI.
         * @param {string} packetName - The human-readable name of the incoming packet.
         * @param {object} packetData - The parsed data object from the incoming packet.
         */
        onPacket(packetName, packetData) {
            if (packetName === 'Update Store Items') {
                const { itemID, itemType, action } = packetData;
                const C = this.core.data.constants;
                if (action === C.PACKET_DATA.STORE_ACTIONS.ADD_ITEM) {
                    this.addWearableButton(itemID, itemType);
                } else if (action === C.PACKET_DATA.STORE_ACTIONS.UPDATE_EQUIPPED) {
                    this.updateEquippedWearable(itemID, itemType);
                }
            }
        },

        /**
         * Called when the game is ready. Injects the CSS and creates the UI for the wearables toolbar.
         */
        onGameReady() {
            if (!this.core.state.playerHasRespawned && !document.getElementById(this.constants.DOM.WEARABLES_TOOLBAR)) {
                // Wait for Game UI to load before proceeding
                const gameUI = document.getElementById(this.core.data.constants.DOM.GAME_UI);
                this.core.waitForVisible(gameUI).then(() => {
                    this.createWearablesToolbarUI();
                    this.setupDynamicPositioning();
                    this.setupStoreMenuObservers();
                });
            }
        },

        // --- INITIAL UI SETUP ---

        /**
         * Creates the HTML structure for the wearables toolbar and appends it to the document body.
         */
        createWearablesToolbarUI() {
            const C = this.constants;
            const CoreC = this.core.data.constants;

            const container = document.createElement('div');
            container.id = C.DOM.WEARABLES_TOOLBAR;
            container.innerHTML = `
                <h1>Wearables Toolbar <span>(Press '${C.HOTKEYS.TOGGLE_WEARABLES}' to toggle)</span></h1>
                <div id="${C.DOM.WEARABLES_HATS}" class="${C.DOM.WEARABLES_GRID_CLASS}"></div>
                <div id="${C.DOM.WEARABLES_ACCESSORIES}" class="${C.DOM.WEARABLES_GRID_CLASS}"></div>
            `;
            
            document.getElementById(CoreC.DOM.GAME_UI).prepend(container);

            const hatsGrid = container.querySelector(`#${C.DOM.WEARABLES_HATS}`);
            const accessoriesGrid = container.querySelector(`#${C.DOM.WEARABLES_ACCESSORIES}`);

            hatsGrid.addEventListener('dragover', this.handleDragOver.bind(this));
            accessoriesGrid.addEventListener('dragover', this.handleDragOver.bind(this));

            document.addEventListener('keydown', (e) => {
                const visibleInputs = [CoreC.DOM.CHAT_HOLDER, CoreC.DOM.ALLIANCE_MENU, CoreC.DOM.STORE_MENU];
                const isInputFocused = visibleInputs.some(id => document.getElementById(id)?.style.display === CoreC.CSS.DISPLAY_BLOCK);
                if (isInputFocused) return;

                if (e.key.toUpperCase() === C.HOTKEYS.TOGGLE_WEARABLES) {
                    this.state.isVisible = !this.state.isVisible;
                    container.style.display = this.state.isVisible ? CoreC.CSS.DISPLAY_BLOCK : CoreC.CSS.DISPLAY_NONE;
                }
            });
        },
        
        /**
         * Sets up an observer to dynamically shift the toolbar's position
         * based on the visibility and height of the item info box.
         */
        setupDynamicPositioning() {
            const C = this.constants;
            const toolbar = document.getElementById(C.DOM.WEARABLES_TOOLBAR);
            const infoHolder = document.getElementById(C.DOM.ITEM_INFO_HOLDER);

            if (!toolbar || !infoHolder) {
                Logger.warn("Could not find toolbar or info holder for dynamic positioning.");
                return;
            }

            const updatePosition = () => {
                const isExpanded = infoHolder.offsetHeight > 0;
                infoHolder.style.setProperty('--top-offset', isExpanded ? `${toolbar.offsetHeight + 20}px` : '0px');
            };

            // Observer 1: Reacts to any change in the info holder's size (e.g., appearing/disappearing).
            const infoHolderObserver = new ResizeObserver(updatePosition);
            infoHolderObserver.observe(infoHolder);

            // Observer 2: Reacts to significant changes in the toolbar's height,
            // which happens when a new row of wearables is pinned.
            let lastToolbarHeight = toolbar.offsetHeight;
            const toolbarObserver = new ResizeObserver(() => {
                const currentHeight = toolbar.offsetHeight;
                // Only update if the height changes by 10px or more to avoid minor fluctuations.
                if (Math.abs(currentHeight - lastToolbarHeight) >= 10) {
                    updatePosition();
                    lastToolbarHeight = currentHeight; // Update the last known height
                }
            });
            toolbarObserver.observe(toolbar);

            // Run once at the start to set the initial position.
            updatePosition();
        },
        
        /** Sets up observers to dynamically resize the store menu and add pin buttons when it opens. */
        setupStoreMenuObservers() {
            const C = this.core.data.constants;
            const storeMenu = document.getElementById(C.DOM.STORE_MENU);
            storeMenu.style.transform = C.CSS.STORE_MENU_TRANSFORM;

            const upgradeHolder = document.getElementById(C.DOM.UPGRADE_HOLDER);
            const upgradeCounter = document.getElementById(C.DOM.UPGRADE_COUNTER);

            const initialCheck = () => {
                const upgradeHolderVisible = upgradeHolder.style.display === C.CSS.DISPLAY_BLOCK;
                const upgradeCounterVisible = upgradeCounter.style.display === C.CSS.DISPLAY_BLOCK;
                const isExpanded = upgradeHolderVisible && upgradeCounterVisible;
                storeMenu.classList.toggle(C.DOM.STORE_MENU_EXPANDED_CLASS, isExpanded);
            };

            const upgradeObserver = new MutationObserver(initialCheck);
            upgradeObserver.observe(upgradeHolder, { attributes: true, attributeFilter: ['style'] });
            upgradeObserver.observe(upgradeCounter, { attributes: true, attributeFilter: ['style'] });
            initialCheck();

            const storeMenuObserver = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (storeMenu.style.display === C.CSS.DISPLAY_BLOCK && mutation.oldValue.includes(`display: ${C.CSS.DISPLAY_NONE}`)) {
                        this.addPinButtons();
                    }
                }
            });
            storeMenuObserver.observe(storeMenu, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });

            const storeHolderObserver = new MutationObserver(() => this.addPinButtons());
            storeHolderObserver.observe(document.getElementById(C.DOM.STORE_HOLDER), { childList: true });
        },
        
        // --- UI MANIPULATION & STATE UPDATES ---

        /**
         * Adds a new button for a wearable item to the appropriate grid (hats or accessories) in the toolbar.
         * @param {number} id - The server-side ID of the wearable item.
         * @param {number} type - The type of wearable (HAT or ACCESSORY).
         */
        addWearableButton(id, type) {
            const C = this.constants;
            const CoreC = this.core.data.constants;
            const containerId = type === CoreC.PACKET_DATA.WEARABLE_TYPES.HAT ? C.DOM.WEARABLES_HATS : C.DOM.WEARABLES_ACCESSORIES;
            const container = document.getElementById(containerId);
            if (!container) return;

            const buttonId = `${C.DOM.WEARABLE_BUTTON_ID_PREFIX}${type}-${id}`;
            if (document.getElementById(buttonId)) return;

            const btn = document.createElement('div');
            btn.id = buttonId;
            btn.className = C.DOM.WEARABLE_BUTTON_CLASS;
            btn.draggable = true;
            btn.dataset.wearableId = id;

            const imagePath = type === CoreC.PACKET_DATA.WEARABLE_TYPES.HAT ? C.URLS.HAT_IMG_PATH : C.URLS.ACCESSORY_IMG_PATH;
            btn.style.backgroundImage = `url(${C.URLS.BASE_IMG}${imagePath}${id}${C.URLS.IMG_EXT})`;
            btn.title = `Item ID: ${id}`;

            btn.addEventListener('dragstart', () => {
                this.state.draggedItem = btn;
                setTimeout(() => btn.classList.add(C.DOM.WEARABLE_DRAGGING_CLASS), C.TIMEOUTS.DRAG_AND_DROP_VISIBILITY);
            });

            btn.addEventListener('dragend', () => {
                setTimeout(() => {
                    if (this.state.draggedItem) this.state.draggedItem.classList.remove(C.DOM.WEARABLE_DRAGGING_CLASS);
                    this.state.draggedItem = null;
                }, C.TIMEOUTS.DRAG_AND_DROP_VISIBILITY);
            });

            btn.addEventListener('click', () => {
                const isCurrentlySelected = btn.classList.contains(C.DOM.WEARABLE_SELECTED_CLASS);
                const newItemId = isCurrentlySelected ? 0 : id;
                this.core.sendGamePacket(CoreC.PACKET_TYPES.EQUIP_WEARABLE, [0, newItemId, type]);
            });

            container.append(btn);
            this.refreshToolbarVisibility();
        },

        /**
         * Updates the visual state of wearable buttons to reflect which item is currently equipped.
         * @param {number} id - The server-side ID of the newly equipped wearable. 0 means unequip.
         * @param {number} type - The type of wearable (HAT or ACCESSORY).
         */
        updateEquippedWearable(id, type) {
            const C = this.constants;
            const CoreC = this.core.data.constants;
            const containerId = type === CoreC.PACKET_DATA.WEARABLE_TYPES.HAT ? C.DOM.WEARABLES_HATS : C.DOM.WEARABLES_ACCESSORIES;
            const container = document.getElementById(containerId);
            if (!container) return;

            const currentSelected = container.querySelector(`.${C.DOM.WEARABLE_SELECTED_CLASS}`);
            if (currentSelected) currentSelected.classList.remove(C.DOM.WEARABLE_SELECTED_CLASS);

            if (id > 0) {
                const buttonId = `${C.DOM.WEARABLE_BUTTON_ID_PREFIX}${type}-${id}`;
                const newSelectedBtn = document.getElementById(buttonId);
                if (newSelectedBtn) newSelectedBtn.classList.add(C.DOM.WEARABLE_SELECTED_CLASS);
            }
        },

        /** Hides/shows wearable buttons based on whether they are pinned. */
        refreshToolbarVisibility() {
            const C = this.constants;
            const CoreC = this.core.data.constants;
            const allButtons = document.querySelectorAll(`.${C.DOM.WEARABLE_BUTTON_CLASS}`);

            allButtons.forEach(btn => {
                const buttonId = parseInt(btn.dataset.wearableId);
                if (!isNaN(buttonId)) {
                    btn.style.display = this.state.pinnedWearables.has(buttonId) ? CoreC.CSS.DISPLAY_BLOCK : CoreC.CSS.DISPLAY_NONE;
                }
            });
        },
        
        // --- PINNING LOGIC ---

        /**
         * Adds "Pin" / "Unpin" buttons to owned wearable items in the store.
         */
        addPinButtons() {
            const CoreC = this.core.data.constants;
            const wearablesMod = this.core.miniMods.find(m => m.name === "Wearables Toolbar");
            if (!wearablesMod) return;

            const C = wearablesMod.constants; // Wearables Constants
            const storeHolder = document.getElementById(CoreC.DOM.STORE_HOLDER);

            Array.from(storeHolder.children).forEach((storeItem) => {
                const joinBtn = storeItem.querySelector('.' + C.DOM.JOIN_ALLIANCE_BUTTON_CLASS);
                const img = storeItem.querySelector('img');

                if (storeItem.querySelector(`.${C.DOM.PIN_BUTTON_CLASS}`)) return;
                if (!joinBtn || !img || !joinBtn.textContent.toLowerCase().includes(C.TEXT.EQUIP_BUTTON_TEXT)) return;

                let id, type;
                const hatMatch = img.src.match(C.REGEX.HAT_IMG);
                const accMatch = img.src.match(C.REGEX.ACCESSORY_IMG);

                if (hatMatch) {
                    id = parseInt(hatMatch[1]);
                    type = CoreC.PACKET_DATA.WEARABLE_TYPES.HAT;
                } else if (accMatch) {
                    id = parseInt(accMatch[1]);
                    type = CoreC.PACKET_DATA.WEARABLE_TYPES.ACCESSORY;
                } else {
                    return; // Not a wearable item
                }

                const isPinned = wearablesMod.isWearablePinned(id);
                const pinButton = document.createElement('div');
                pinButton.className = `${C.DOM.JOIN_ALLIANCE_BUTTON_CLASS} ${C.DOM.PIN_BUTTON_CLASS}`;
                pinButton.style.marginTop = '5px';
                pinButton.textContent = isPinned ? C.TEXT.UNPIN : C.TEXT.PIN;

                pinButton.addEventListener('click', () => {
                    const isNowPinned = wearablesMod.togglePin(id, type);
                    pinButton.textContent = isNowPinned ? C.TEXT.UNPIN : C.TEXT.PIN;
                    wearablesMod.refreshToolbarVisibility();
                });

                joinBtn.insertAdjacentElement('afterend', pinButton);
            });
        },

        /**
         * Checks if a wearable is currently pinned to the toolbar.
         * @param {number} id The ID of the wearable to check.
         * @returns {boolean} True if the wearable is pinned.
         */
        isWearablePinned(id) {
            return this.state.pinnedWearables.has(id);
        },

        /**
         * Toggles the pinned state of a wearable item.
         * @param {number} id - The ID of the wearable to pin/unpin.
         * @param {number} type - The type of the wearable (HAT/ACCESSORY).
         * @returns {boolean} - True if the item is now pinned, false otherwise.
         */
        togglePin(id, type) {
            const pinned = this.state.pinnedWearables;
            if (pinned.has(id)) { // Unpin
                pinned.delete(id);
                return false;
            } else { // Pin
                pinned.add(id);
                this.addWearableButton(id, type);
                return true;
            }
        },

        // --- EVENT HANDLERS (DRAG & DROP) ---

        /**
         * Handles the dragover event for the wearables grid to allow for live reordering.
         * @param {DragEvent} e - The drag event.
         */
        handleDragOver(e) {
            e.preventDefault();
            const grid = e.currentTarget;
            const currentlyDragged = this.state.draggedItem;
            if (!currentlyDragged) return;

            // Determine where the item SHOULD be placed.
            const afterElement = this._getDragAfterElement(grid, e.clientX, e.clientY);
            
            // Optimization: Prevent DOM updates if position hasn't changed to avoid jitter.
            if (currentlyDragged.nextSibling === afterElement) return;

            grid.insertBefore(currentlyDragged, afterElement);
        },

        // --- HELPER FUNCTIONS ---

        /**
         * Finds the sibling element that should come after the dragged item in a grid layout.
         * @param {HTMLElement} container - The grid container.
         * @param {number} x - The cursor's horizontal position.
         * @param {number} y - The cursor's vertical position.
         * @returns {HTMLElement|null} The sibling to insert before, or null to append at the end.
         */
        _getDragAfterElement(container, x, y) {
            const C = this.constants;
            const selector = `.${C.DOM.WEARABLE_BUTTON_CLASS}:not(.${C.DOM.WEARABLE_DRAGGING_CLASS})`;
            const draggableSiblings = [...container.querySelectorAll(selector)];

            for (const sibling of draggableSiblings) {
                const box = sibling.getBoundingClientRect();
                const isVerticallyBefore = y < box.top + box.height / 2;
                const isInRow = y >= box.top && y <= box.bottom;
                const isHorizontallyBefore = x < box.left + box.width / 2;

                if (isVerticallyBefore || (isInRow && isHorizontallyBefore)) {
                    return sibling;
                }
            }
            
            return null; // If after all other elements
        },
    };

    /**
     * @module TypingIndicatorMiniMod
     * @description Shows a "..." typing indicator in chat while the user is typing,
     * while respecting the game's chat rate limit to ensure user messages are prioritized.
     */
    const TypingIndicatorMiniMod = {
        
        // --- MINI-MOD PROPERTIES ---

        /** @property {object|null} core - A reference to the core module object, set upon registration. */
        core: null,

        /** @property {string} name - The display name of the minimod. */
        name: "Typing Indicator",
        
        /**
         * @property {object} config - Holds user-configurable settings for the script.
         */
        config: {
            INDICATOR_INTERVAL: 1000, // ms between each animation frame
            RATE_LIMIT_MS: 550,
            START_DELAY: 1000,       // A safe buffer for the ~500ms chat cooldown
            ANIMATION_FRAMES: ['.', '..', '...'],
            QUEUE_PROCESSOR_INTERVAL: 100, // How often to check the message queue
        },

        /** @property {object} state - Dynamic state for this minimod. */
        state: {
            chatBoxElement: null,
            indicatorIntervalId: null,
            startIndicatorTimeoutId: null,
            queueProcessorIntervalId: null,
            animationFrameIndex: 0,
            lastMessageSentTime: 0,
            messageQueue: [],
        },

        // --- MINI-MOD LIFECYCLE & HOOKS ---

        /**
         * Finds the chat box element and attaches all necessary event listeners for the mod to function.
         * This is the entry point for the minimod's setup.
         */
        addEventListeners() {
            this.state.chatBoxElement = document.getElementById('chatBox');

            if (!this.state.chatBoxElement) {
                Logger.error("Could not find chatBox element. Mod will not function.");
                return;
            }

            this.state.chatBoxElement.addEventListener('focus', this.handleFocus.bind(this));
            this.state.chatBoxElement.addEventListener('blur', this.handleBlur.bind(this));
            this.state.chatBoxElement.addEventListener('keydown', this.handleKeyDown.bind(this));
            
            // Start the queue processor, which will run continuously to send queued messages.
            this.startQueueProcessor();
            Logger.log("Event listeners attached and queue processor started.");
        },

        // --- EVENT HANDLERS ---

        /** Handles when the user clicks into the chat box. */
        handleFocus() {
            // Instead of starting immediately, set a timeout to begin the animation.
            // This prevents the indicator from flashing for accidental clicks or very fast messages.
            if (this.state.startIndicatorTimeoutId) clearTimeout(this.state.startIndicatorTimeoutId); // <-- NEW
            this.state.startIndicatorTimeoutId = setTimeout(() => { // <-- CHANGED
            this.startTypingIndicator();
            }, this.config.START_DELAY);
        },

        /** Handles when the user clicks out of the chat box. */
        handleBlur() {
            clearTimeout(this.state.startIndicatorTimeoutId); // <-- NEW: Cancel pending start
            this.stopTypingIndicator();
        },

        /** Intercepts the 'Enter' key press to queue the user's message instead of sending it immediately. */
        handleKeyDown(event) {
            if (event.key === 'Enter') {
                // Prevent the game from sending the message. We will handle it.
                event.preventDefault();
                clearTimeout(this.state.startIndicatorTimeoutId); // <-- NEW: Cancel pending start

                const message = this.state.chatBoxElement.value.trim();
                if (message) {
                    this.queueUserMessage(message);
                }

                // Clear the chat box and stop the indicator, as the user is done typing.
                this.state.chatBoxElement.value = '';
                this.stopTypingIndicator();
            }
        },
        
        // --- CORE LOGIC ---

        /** Starts the "..." animation loop. */
        startTypingIndicator() {
            if (this.state.indicatorIntervalId) return; // Already running

            Logger.log("Starting typing indicator.");
            this.state.animationFrameIndex = 0;
            
            // Run once immediately, then start the interval
            this.animateIndicator();
            this.state.indicatorIntervalId = setInterval(this.animateIndicator.bind(this), this.config.INDICATOR_INTERVAL);
        },

        /** Stops the "..." animation loop and clears the indicator from chat. */
        stopTypingIndicator() {
            if (!this.state.indicatorIntervalId) return; // Already stopped

            Logger.log("Stopping typing indicator and cleaning up queue.");
            clearInterval(this.state.indicatorIntervalId);
            this.state.indicatorIntervalId = null;

            // Remove any pending system messages
            this.state.messageQueue = this.state.messageQueue.filter(msg => msg.type !== 'system');

            // Queue one final, empty message to clear the indicator that might be visible in chat.
            this.queueSystemMessage('');
        },
        
        /** Sends the next frame of the animation. */
        animateIndicator() {
            const frame = this.config.ANIMATION_FRAMES[this.state.animationFrameIndex];
            this.queueSystemMessage(frame);
            
            // Cycle to the next frame
            this.state.animationFrameIndex = (this.state.animationFrameIndex + 1) % this.config.ANIMATION_FRAMES.length;
        },

        // --- RATE LIMIT & QUEUE MANAGEMENT ---

        /** Starts the interval that processes the message queue. */
        startQueueProcessor() {
            if (this.state.queueProcessorIntervalId) return;
            this.state.queueProcessorIntervalId = setInterval(this.processMessageQueue.bind(this), this.config.QUEUE_PROCESSOR_INTERVAL);
        },

        /** Adds a user's message to the front of the queue to be sent. */
        queueUserMessage(message) {
            Logger.log(`Queueing user message: "${message}"`);
            this.state.messageQueue.unshift({ type: 'user', content: message });
        },
        
        /** Adds a system message (like the indicator) to the back of the queue. */
        queueSystemMessage(message) {
            // Optimization: Don't queue up a ton of indicator dots. 
            // If the last message in the queue is also an indicator, replace it.
            const lastInQueue = this.state.messageQueue[this.state.messageQueue.length - 1];
            if (lastInQueue && lastInQueue.type === 'system') {
                this.state.messageQueue[this.state.messageQueue.length - 1].content = message;
            } else {
                this.state.messageQueue.push({ type: 'system', content: message });
            }
        },
        
        /**
         * Checks the queue and sends the next message if the chat rate limit has passed.
         * This is the core of the rate-limiting solution.
         */
        processMessageQueue() {
            const canSendMessage = Date.now() - this.state.lastMessageSentTime > this.config.RATE_LIMIT_MS;
            
            if (canSendMessage && this.state.messageQueue.length > 0) {
                const messageToSend = this.state.messageQueue.shift(); // Get the next message
                
                this.core.sendGamePacket('6', [messageToSend.content]);
                this.state.lastMessageSentTime = Date.now();
                
                if (messageToSend.type === 'user') {
                    Logger.log(`Sent queued user message: "${messageToSend.content}"`);
                }
            }
        }
    };

    /**
     * @module AssistedHealMiniMod
     * @description A minimod that allows the player to automatically eat food by holding down a key.
     */
    const AssistedHealMiniMod = {

        // --- MINI-MOD PROPERTIES ---

        /** @property {object|null} core - A reference to the core module object, set upon registration. */
        core: null,

        /** @property {string} name - The display name of the minimod. */
        name: "Assisted Healing",

        /**
         * @property {object} config - Holds user-configurable settings for the script.
         */
        config: {
            HEAL_KEY: 'Q',      // The key to hold for healing
            HEAL_INTERVAL: 100, // How often to attempt to heal, in milliseconds
        },

        /** @property {object} state - Dynamic state for this minimod. */
        state: {
            isHealKeyHeld: false,
            healIntervalId: null,
            lastHealTime: 0,
        },

        // --- MINI-MOD LIFECYCLE & HOOKS ---

        init() {
            // This is where you could load settings from localStorage if you had them
            this.addEventListeners();
        },

        addEventListeners() {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.addEventListener('keyup', this.handleKeyUp.bind(this));
        },

        // --- EVENT HANDLERS ---

        handleKeyDown(event) {
            if (this._isInputFocused() || event.key.toUpperCase() !== this.config.HEAL_KEY) return;
            
            if (!this.state.isHealKeyHeld) {
                this.state.isHealKeyHeld = true;
                this.startHealing();
            }
        },

        handleKeyUp(event) {
            if (event.key.toUpperCase() === this.config.HEAL_KEY) {
                this.state.isHealKeyHeld = false;
                this.stopHealing();
            }
        },

        // --- CORE LOGIC ---

        startHealing() {
            if (this.state.healIntervalId) return; // Already healing

            Logger.log("Starting Assisted Heal.", "color: #00e676;");
            // Immediately try to heal once, then start the interval
            this.attemptHeal();
            this.state.healIntervalId = setInterval(this.attemptHeal.bind(this), this.config.HEAL_INTERVAL);
        },

        stopHealing() {
            if (this.state.healIntervalId) {
                Logger.log("Stopping Assisted Heal.", "color: #ff1744;");
                clearInterval(this.state.healIntervalId);
                this.state.healIntervalId = null;
            }
        },

        attemptHeal() {
            const C = this.core.data.constants;

            // Find the first available food item on the action bar
            const actionBar = document.getElementById(C.DOM.ACTION_BAR);
            if (!actionBar) return;

            const foodItemElem = Array.from(actionBar.children).find(el => {
                const itemData = this.core.getItemFromElem(el);
                return itemData && itemData.itemType === C.ITEM_TYPES.FOOD && this.core.isEquippableItem(el);
            });

            if (foodItemElem) {
                const foodItemData = this.core.getItemFromElem(foodItemElem);
                if (foodItemData) {
                    // The game uses an empty array for "use item at current location"
                    this.core.sendGamePacket(C.PACKET_TYPES.EQUIP_ITEM, [foodItemData.id, false]);
                    this.core.sendGamePacket(C.PACKET_TYPES.USE_ITEM, [C.PACKET_DATA.USE_ACTIONS.START_USING]); // 1 is "start using"
                    this.core.sendGamePacket(C.PACKET_TYPES.USE_ITEM, [C.PACKET_DATA.USE_ACTIONS.STOP_USING]); // 0 is "stop using"
                }
            }
        },

        // --- HELPER FUNCTIONS ---

        _isInputFocused() {
            const C = this.core.data.constants;
            const isVisible = (id) => {
                const elem = document.getElementById(id);
                return elem && elem.style.display === C.CSS.DISPLAY_BLOCK;
            };
            return isVisible(C.DOM.CHAT_HOLDER) || isVisible(C.DOM.STORE_MENU) || isVisible(C.DOM.ALLIANCE_MENU);
        }
    };

    // --- REGISTER MINI-MODS & INITIALIZE ---

    MooMooUtilityMod.registerMod(ScrollInventoryMiniMod);
    MooMooUtilityMod.registerMod(WearablesToolbarMiniMod);
    MooMooUtilityMod.registerMod(TypingIndicatorMiniMod);
    MooMooUtilityMod.registerMod(AssistedHealMiniMod);

    MooMooUtilityMod.init();
})();