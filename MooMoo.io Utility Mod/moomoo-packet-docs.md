# MooMoo.io WebSocket Packet Documentation

This document outlines the WebSocket packet structure for the game MooMoo.io. The information is derived from reverse-engineering the client-side JavaScript code. This data was manually obtained by TigerYT, and detailed in this document using AI.

## Packet Format

All data is sent and received as a binary message, encoded using `msgpack`. After being decoded by the client, the message is structured as a JavaScript array:

```javascript
[packetID, [payload_array]]
```

-   `packetID`: A string or number that identifies the message type.
-   `payload_array`: An array containing all the data associated with that message.

---

## Table of Contents
1.  [Server to Client Packets](#server-to-client-packets)
    1.  [Connection & Session](#connection--session)
    2.  [Player & Entity State](#player--entity-state)
    3.  [Resources, Items & Upgrades](#resources-items--upgrades)
    4.  [World Objects & Interaction](#world-objects--interaction)
    5.  [Combat](#combat)
    6.  [Clans & Social](#clans--social)
    7.  [UI & Miscellaneous](#ui--miscellaneous)
2.  [Client to Server Packets](#client-to-server-packets)

---

## Server to Client Packets

Packets sent from the server to the client.

### Connection & Session

Packets related to the WebSocket connection state and player session initialization.

### `io-init`
-   **Name**: Initial Connection
-   **Description**: The first packet sent from the server to confirm a successful connection. It provides the client's unique `socketID` for the session.
-   **Payload**: `[socketID: string]`
-   **Example**: `["io-init", ["iO8Ddwntku"]]`
-   **Frequency**: Once, at the beginning of a session.

#### `B`
-   **Name**: Disconnect
-   **Description**: Notifies the client that they have been disconnected from the server.
-   **Payload**: `[reason: string]`
-   **Frequency**: Event-driven.

#### `C`
-   **Name**: Setup Game
-   **Description**: Initializes the main player on the client, assigning them a unique in-game Session ID (`SID`).
-   **Payload**: `[yourSID: number]`
-   **Frequency**: Once, after a successful spawn request.

#### `Z`
-   **Name**: Server Shutdown Notice
-   **Description**: Informs the client that the server is restarting soon.
-   **Payload**: `[countdownSeconds: number]`
-   **Frequency**: Event-driven, before a server restart.

#### `0`
-   **Name**: Ping Response
-   **Description**: The server's response to the client's ping packet (`0`). Used to calculate latency.
-   **Payload**: `[]` (Empty)
-   **Frequency**: High (every few seconds).

### Player & Entity State

Packets that describe the state of players and other living entities on the map.

#### `D`
-   **Name**: Add Player
-   **Description**: Sent when a player (either the client or another player) spawns or enters the client's view. Provides all the data needed to render that player.
-   **Payload**: `[playerData: Array, isYou: boolean]`
    -   `playerData`: `[id: number, sid: number, name: string, x: number, y: number, dir: number, health: number, maxHealth: number, scale: number, skinColor: number]`
-   **Frequency**: Event-driven.

#### `E`
-   **Name**: Remove Player
-   **Description**: Sent when a player goes out of view or disconnects. The player is identified by their numerical `id`.
-   **Payload**: `[playerID: number]`
-   **Frequency**: Event-driven.

#### `P`
-   **Name**: Client Player Death
-   **Description**: Sent when the client's own player has died.
-   **Payload**: `[]` (Empty)
-   **Frequency**: Event-driven (on death).

#### `a` (lowercase)
-   **Name**: Update Players
-   **Description**: A high-frequency packet that broadcasts the state of all visible players. It contains a flattened array of player data.
-   **Payload**: A flattened array where each player is represented by 13 values: `[p1_sid, p1_x, p1_y, p1_dir, p1_buildIndex, p1_weaponIndex, p1_weaponVariant, p1_team, p1_isLeader, p1_skinIndex, p1_tailIndex, p1_iconIndex, p1_zIndex, p2_sid, ...]`
-   **Frequency**: Very High (multiple times per second).

#### `I`
-   **Name**: Update AI
-   **Description**: Updates the state of all visible non-player characters (animals, mobs).
-   **Payload**: A flattened array where each AI is represented by 7 values: `[ai_sid, ai_index, ai_x, ai_y, ai_dir, ai_health, ai_nameIndex]`
-   **Frequency**: High.

#### `O`
-   **Name**: Update Health
-   **Description**: Sent when a player's health changes.
-   **Payload**: `[playerSID: number, newHealth: number]`
-   **Frequency**: Event-driven.

#### `N`
-   **Name**: Update Player Value
-   **Description**: Updates a specific property on the client's player object (e.g; resources, kills).
-   **Payload**: `[propertyName: string, newValue: number, updateView: boolean]`
-   **Frequency**: Event-driven.

### Resources, Items & Upgrades

Packets related to managing player inventory, resources, and the shop.

#### `T`
-   **Name**: Update Age
-   **Description**: Sent whenever the player gains XP or ages up.
-   **Payload**: `[currentXP: number, maxXP?: number, age?: number]` (maxXP and age are optional)
-   **Frequency**: Event-driven.

#### `U`
-   **Name**: Update Upgrades
-   **Description**: Sent when the player ages up, informing the client which items are available to be unlocked.
-   **Payload**: `[upgradePoints: number, age: number]`
-   **Frequency**: Event-driven (on age up).

#### `V`
-   **Name**: Update Items
-   **Description**: Updates the player's available buildable items or equippable weapons that appear on the action bar.
-   **Payload**: `[id_array: number[], isWeaponList: boolean]`
-   **Frequency**: Event-driven (after upgrading).

#### `S`
-   **Name**: Update Item Counts
-   **Description**: Updates the quantity of a stackable, placeable item group (e.g; walls, spikes).
-   **Payload**: `[itemGroupID: number, newCount: number]`
-   **Frequency**: Event-driven.

#### `5`
-   **Name**: Update Store Items
-   **Description**: Confirms a store action (buy/equip) and updates the player's state.
-   **Payload**: `[itemType: number, itemID: number, action: number]`
    - `itemType`: `0` for hats, `1` for accessories.
    - `action`: `0` for buying, `1` for equipping.
-   **Frequency**: Event-driven.

### World Objects & Interaction

Packets for creating, destroying, and interacting with map objects.

#### `H`
-   **Name**: Load Game Objects
-   **Description**: Populates the client's map with world objects (trees, rocks, player-built structures).
-   **Payload**: A flattened array where each object is represented by 8 values: `[sid, x, y, dir, scale, type, itemID, ownerSID]`
-   **Frequency**: Event-driven (on moving to new areas).

#### `Q`
-   **Name**: Kill Object
-   **Description**: Informs the client that a single world object has been destroyed.
-   **Payload**: `[objectSID: number]`
-   **Frequency**: Event-driven.

#### `R`
-   **Name**: Kill Objects
-   **Description**: Removes all placed objects belonging to a specific player SID (e.g; when they die).
-   **Payload**: `[ownerSID: number]`
-   **Frequency**: Event-driven.

#### `L`
-   **Name**: Wiggle Game Object
-   **Description**: Triggers the "wiggle" animation on a world object when it's hit.
-   **Payload**: `[direction: number, objectSID: number]`
-   **Frequency**: Event-driven.

### Combat

Packets specifically for combat-related events.

#### `K`
-   **Name**: Gather Animation
-   **Description**: Instructs the client to play the gather/attack animation for a specific player.
-   **Payload**: `[playerSID: number, didHit: boolean, weaponIndex: number]`
-   **Frequency**: Event-driven.

#### `J`
-   **Name**: Animate AI
-   **Description**: Triggers a special, non-standard animation for an AI, such as a boss's attack.
-   **Payload**: `[aiSID: number]`
-   **Frequency**: Event-driven.

#### `X`
-   **Name**: Add Projectile
-   **Description**: Sent when a new projectile (e.g; arrow) is created.
-   **Payload**: `[x: number, y: number, dir: number, range: number, speed: number, index: number, layer: number, sid: number]`
-   **Frequency**: Event-driven.

#### `Y`
-   **Name**: Remove Projectile
-   **Description**: Does not actually remove the projectile, but updates its range, causing it to visually collide and despawn.
-   **Payload**: `[projectileSID: number, newRange: number]`
-   **Frequency**: Event-driven (on projectile collision).

#### `M`
-   **Name**: Shoot Turret
-   **Description**: Signals that a player-built turret has fired a projectile.
-   **Payload**: `[turretSID: number, direction: number]`
-   **Frequency**: Event-driven.

### Clans & Social

Packets for managing clans (alliances/tribes).

#### `A` (uppercase)
-   **Name**: All Clans List
-   **Description**: Sent on joining the server, provides a list of all existing clans.
-   **Payload**: `[{ teams: [{ sid: string, owner: number }] }]`
-   **Frequency**: Once, on connect.

#### `g` (lowercase)
-   **Name**: Add Alliance
-   **Description**: Notifies clients that a new clan has been created.
-   **Payload**: `[clanData: { sid: string, owner: number }]`
-   **Frequency**: Event-driven.

#### `1`
-   **Name**: Delete Alliance
-   **Description**: A clan has been disbanded.
-   **Payload**: `[clanSID: string]`
-   **Frequency**: Event-driven.

#### `3`
-   **Name**: Set Player Team
-   **Description**: Sets the client's own clan status.
-   **Payload**: `[teamSID: string, isOwner: boolean]`
-   **Frequency**: Event-driven.

#### `4`
-   **Name**: Set Alliance Players
-   **Description**: Updates the client's list of current clan members.
-   **Payload**: A flattened array: `[player1_sid, player1_name, player2_sid, player2_name, ...]`
-   **Frequency**: Event-driven.

#### `2`
-   **Name**: Alliance Notification
-   **Description**: Sent to a clan leader when another player requests to join.
-   **Payload**: `[requestingPlayerSID: number, requestingPlayerName: string]`
-   **Frequency**: Event-driven.

#### `6`
-   **Name**: Receive Chat
-   **Description**: A player has sent a message in the chat.
-   **Payload**: `[senderSID: number, message: string]`
-   **Frequency**: Event-driven.

### UI & Miscellaneous

#### `G`
-   **Name**: Leaderboard Update
-   **Description**: Sends updated data for the leaderboard.
-   **Payload**: A flattened array of `[playerSID: number, name: string, score: number]` for each player on the board.
-   **Frequency**: High (every few seconds).

#### `7`
-   **Name**: Update Minimap
-   **Description**: Sends the coordinates of all clan allies to be displayed on the minimap.
-   **Payload**: A flattened array: `[ally1_x, ally1_y, ally2_x, ally2_y, ...]`
-   **Frequency**: Moderate (every few seconds).

#### `8`
-   **Name**: Show Text
-   **Description**: Creates floating text on the screen, typically used for damage/healing numbers.
-   **Payload**: `[x: number, y: number, value: number, type: number]`
-   **Frequency**: Event-driven.

#### `9`
-   **Name**: Ping Map
-   **Description**: Creates a visual ping on the minimap at the specified coordinates.
-   **Payload**: `[x: number, y: number]`
-   **Frequency**: Event-driven.

---

## Client to Server Packets

Packets sent from the client to the server.

#### `M`
-   **Name**: Spawn
-   **Description**: Sent to join the game and spawn the player character.
-   **Payload**: `[spawnData: {name: string, moofoll: boolean, skin: number}]`

#### `D`
-   **Name**: Set Aim Direction
-   **Description**: Continuously updates the server with the player's aim direction.
-   **Payload**: `[angle: number]`

#### `9`
-   **Name**: Set Movement Direction
-   **Description**: Updates the server with the player's current movement direction. Sent on change.
-   **Payload**: `[angle: number | undefined]`

#### `e`
-   **Name**: Stop Movement
-   **Description**: Sent when the client window loses focus to stop the player from moving.
-   **Payload**: `[]` (Empty)

#### `F`
-   **Name**: Set Attack State
-   **Description**: Tells the server if the player is attacking/building (`1`) or not (`0`).
-   **Payload**: `[isAttacking: number, buildAngle?: number]`

#### `z`
-   **Name**: Select Item
-   **Description**: Selects an item from the action bar to build or equip.
-   **Payload**: `[itemID: number, isWeapon: boolean]`

#### `K`
-   **Name**: Player Action
-   **Description**: A multi-purpose packet for various toggles.
-   **Payload**: `[actionType: number]`
    - `0`: Toggle aim lock.
    - `1`: Toggle auto-gather/attack.

#### `S`
-   **Name**: Map Ping
-   **Description**: Pings the minimap for allies.
-   **Payload**: `[1]`

#### `H`
-   **Name**: Select Upgrade
-   **Description**: Sent when a player chooses an item from the age-up screen.
-   **Payload**: `[itemIndex: number]`

#### `L`
-   **Name**: Create Clan
-   **Description**: Attempts to create a new clan.
-   **Payload**: `[clanName: string]`

#### `N`
-   **Name**: Leave Clan
-   **Description**: Sent to leave the current clan.
-   **Payload**: `[]` (Empty)

#### `b`
-   **Name**: Join Clan Request
-   **Description**: Sends a request to join a clan.
-   **Payload**: `[clanSID: string]`

#### `P`
-   **Name**: Respond to Join Request
-   **Description**: Sent by a clan leader to accept (`1`) or decline (`0`) a join request.
-   **Payload**: `[requestingPlayerSID: number, accepted: boolean]`

#### `Q`
-   **Name**: Kick from Clan
-   **Description**: Sent by a clan leader to kick a member.
-   **Payload**: `[playerSIDToKick: number]`

#### `c`
-   **Name**: Store Action
-   **Description**: Sent to buy or equip a cosmetic item.
-   **Payload**: `[action: number, itemID: number, itemType: number]`
    - `action`: `1` to buy, `0` to equip.
    - `itemType`: `0` for hats, `1` for accessories.

#### `6`
-   **Name**: Send Chat
-   **Description**: Sends a chat message to the server.
-   **Payload**: `[message: string]`

#### `0`
-   **Name**: Ping
-   **Description**: The client's response to the server's ping (`0`) packet.
-   **Payload**: `[]` (Empty)