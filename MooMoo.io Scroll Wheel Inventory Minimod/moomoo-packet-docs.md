# MooMoo.io WebSocket Packet Documentation - Not Accurate

This document outlines the server-to-client WebSocket packet structure for the game MooMoo.io. The information is derived from reverse-engineering the client-side JavaScript code and analyzing live network traffic. This data was manually obtained by TigerYT, and detailed in this document using AI.

## Packet Format

All data is sent from the server as a binary message. After being processed by the client's `Decoder`, the message is structured as a JavaScript array:

```javascript
[packetID, [payload_array]]
```

-   `packetID`: A string or number that identifies the message type.
-   `payload_array`: An array containing all the data associated with that message.

---

## Table of Contents
1.  [Connection & Session](#connection--session)
2.  [Player & Entity State](#player--entity-state)
3.  [Resources, Items & Upgrades](#resources-items--upgrades)
4.  [World Objects & Interaction](#world-objects--interaction)
5.  [Combat](#combat)
6.  [Clans & Social](#clans--social)
7.  [UI & Miscellaneous](#ui--miscellaneous)
8.  [Unidentified Packets](#unidentified-packets)

---

## Connection & Session

Packets related to the WebSocket connection state and player session initialization.

### `io-init`
-   **Name**: Initial Connection
-   **Description**: The first packet sent from the server to confirm a successful connection. It provides the client's unique `socketID` for the session.
-   **Payload**: `[socketID: string]`
-   **Example**: `["io-init", ["iO8Ddwntku"]]`
-   **Frequency**: Once, at the beginning of a session.

### `0`
-   **Name**: Ping
-   **Description**: A keep-alive packet sent periodically to check if the connection is active. The client is expected to respond.
-   **Payload**: `[]` (Empty)
-   **Example**: `["0", []]`
-   **Frequency**: High (every few seconds).

## Player & Entity State

Packets that describe the state of players and other living entities on the map.

### `C`
-   **Name**: Client Player Initialization
-   **Description**: Initializes the main player character on the client, assigning them a unique in-game ID.
-   **Payload**: `[playerID: number]`
-   **Example**: `["C", [1]]`
-   **Frequency**: Once, after the initial connection.

### `P`
-   **Name**: Player Death / Reset
-   **Description**: Sent when the client's player has died. This suggests a reset of health, inventory, and age.
-   **Payload**: `[]` (Empty)
-   **Example**: `["P", []]`
-   **Frequency**: Event-driven (on death).

### `D`
-   **Name**: Other Player Spawn
-   **Description**: Sent when another player enters the client's view. Provides all the data needed to render that player.
-   **Payload**: `[socketID: string, id: number, nickname: string, x: number, y: number, angle: number, health: number, maxHealth: number, size: number, skinID: number], isClientPlayer: boolean]`
-   **Example**: `["D", ["iO8Ddwntku", 1, "TigerYT", 1796, 3069, 0, 100, 100, 35, 0, true]]`
-   **Frequency**: Event-driven.

### `E`
-   **Name**: Player Despawn
-   **Description**: Sent when a player goes out of view or disconnects.
-   **Payload**: `[socketID: string]`

### `a` (lowercase)
-   **Name**: All Players State Update
-   **Description**: A high-frequency packet that broadcasts the state of all visible players. It contains a flattened array of player data.
-   **Payload**: `[player1_ID, p1_x, p1_y, p1_angle, ..., player2_ID, p2_x, ...]`
-   **Example**: `["a", [1, 1796, 3069, 0.21, -1, 0, 0, "", 0, 0, 0, 0, 0]]` (This is one player's data within the larger array).
-   **Frequency**: Very High (multiple times per second).

### `I`
-   **Name**: All Animals / NPCs State Update
-   **Description**: Similar to packet `a`, this updates the state of all visible non-player characters (animals, mobs).
-   **Payload**: A flattened array of animal data. Each animal's data appears to be `[id: number, type: number, x: number, y: number, angle: number, health: number, maxHealth: number]`
-   **Example**: `["I", [16, 4, 2544, 3847, 4.64, 300, 30]]`
-   **Frequency**: Very High.

## Resources, Items & Upgrades

Packets related to managing player inventory, resources, and the shop.

### `N`
-   **Name**: Resource Update
-   **Description**: Updates the amount of a specific resource the player has (e.g., gold, wood, stone).
-   **Payload**: `[resourceType: string, newAmount: number, source: number]` (where `resourceType` can be `'points'`, `'wood'`, `'stone'`, or `'food'`).
-   **Example**: `["N", ["points", 150, 1]]`
-   **Frequency**: Event-driven (on resource gain).

### `U`
-   **Name**: Upgrade / Buy Item
-   **Description**: Confirms the purchase or upgrade of an item from the shop.
-   **Payload**: `[serverItemID: number, levelOrCount: number]`
-   **Frequency**: Event-driven.

### `S`
-   **Name**: Item Count Update
-   **Description**: Updates the quantity of a stackable, placeable item (like food, walls, or spikes).
-   **Payload**: `[serverItemID: number, newCount: number]`
-   **Frequency**: Event-driven.

### `T`
-   **Name**: Player Age Update
-   **Description**: Sent whenever the player gains xp or ages up after accumulating enough score.
-   **Payload**: `[currentExp: number, requiredExp?: number, nextAge?: number]`
-   **Frequency**: Event-driven.

### `5`
-   **Name**: Store / Shop State Update
-   **Description**: Updates the visual state of an item in the shop (e.g., affordable, locked, unlocked).
-   **Payload**: `[action: number, itemID: number, state: number]`
-   **Frequency**: Event-driven.

## World Objects & Interaction

Packets for creating, destroying, and interacting with static map objects like trees and rocks.

### `H`
-   **Name**: Create Map Objects
-   **Description**: Populates the client's map with world objects (trees, rocks, bushes) when entering an area. Contains a flattened array of object data.
-   **Payload**: `[obj1_id, obj1_x, obj1_y, ..., obj2_id, ...]`
-   **Example**: `["H", [34, 1811, 3765.1, 0, 80, 1, "", -1, ...]]`
-   **Frequency**: Event-driven (on moving to new areas).

### `Q`
-   **Name**: Remove Map Object
-   **Description**: Informs the client that a world object has been destroyed and should be removed.
-   **Payload**: `[objectID: number]`
-   **Frequency**: Event-driven.

### `R`
-   **Name**: Remove Player-Placed Objects
-   **Description**: Removes all placed objects belonging to a player who has died or gone out of view.
-   **Payload**: `[playerID: number]`
-   **Frequency**: Event-driven.

### `L`
-   **Name**: Object Damaged
-   **Description**: Triggers the "hit" animation on a world object (e.g., an apple bush might have ID: 43, and anothe rapple bush may have ID: 44).
-   **Payload**: `[playerAnimAngle: number, objectID: number]`
-   **Frequency**: Event-driven.

## Combat

Packets specifically for combat-related events.

### `O`
-   **Name**: Player Health Update
-   **Description**: Sent when a player's health changes due to damage or regeneration.
-   **Payload**: `[playerID: number, newHealth: number]`
-   **Example**: `["O", [1, 90.4]]`
-   **Frequency**: Event-driven.

### `K`
-   **Name**: Player Attack Animation
-   **Description**: Instructs the client to play the attack animation for a specific player.
-   **Payload**: `[attackingPlayerID: number, victimPlayerID: number, unknown: number]`
-   **Frequency**: Event-driven.

### `M`
-   **Name**: Turret Fired
-   **Description**: Signals that a turret has fired a projectile.
-   **Payload**: `[turretObjectID: number, angle: number]`
-   **Frequency**: Event-driven.

### `X`
-   **Name**: Create Projectile
-   **Description**: Sent when a new projectile (e.g., arrow) is created.
-   **Payload**: `[x: number, y: number, angle: number, type: number, speed: number, range: number, ownerID: number, damage: number]`
-   **Frequency**: Event-driven.

### `J`
-   **Name**: Boss Skill / Animation Trigger
-   **Description**: A special packet sent to trigger a specific, non-standard animation, such as a boss's unique attack. Observed with the boss Moostafa's axe swing.
-   **Payload**: `[animationID: number]`
-   **Example**: `["J", [23]]`

## Clans & Social

Packets for managing teams and clans.

### `A` (uppercase)
-   **Name**: All Clans List
-   **Description**: Sent on joining the server, provides a list of all existing clans.
-   **Payload**: `[{ teams: [{ sid: string, owner: number }] }]`

### `g` (lowercase)
-   **Name**: Clan Created
-   **Description**: A new clan has been created.
-   **Payload**: `[{ sid: string, owner: number }]`

### `1`
-   **Name**: Clan Disbanded
-   **Description**: A clan has been disbanded and should be removed from the list.
-   **Payload**: `[clanSID: string]`

### `4`
-   **Name**: Clan Member Update
-   **Description**: Updates the client's list of current clan members.
-   **Payload**: `[[playerID: number, playerName: string], ...]`
-   **Frequency**: Event-driven.

### `3`
-   **Name**: Leave / Disband Clan
-   **Description**: Notifies the client that they are no longer in a clan.
-   **Payload**: Unclear.
-   **Frequency**: Event-driven.

### `2`
-   **Name**: Clan Join Request
-   **Description**: Sent to a clan leader when another player requests to join.
-   **Payload**: `[requestingPlayerName: string, requestingPlayerID: number]`
-   **Frequency**: Event-driven.

### `6`
-   **Name**: Chat Message Received
-   **Description**: A player has sent a message in the chat.
-   **Payload**: `[playerID: number, message: string]`

## UI & Miscellaneous

### `G`
-   **Name**: Leaderboard Update
-   **Description**: Sends updated data for the leaderboard.
-   **Payload**: A flattened array of `[rank: number, name: string, score: number]` for each player on the board.
-   **Example**: `["G", [1, "TigerYT", 100]]`
-   **Frequency**: High (every few seconds).

## Unidentified Packets

### `7`
-   **Name**: Unknown Event
-   **Description**: A periodic packet not handled in the client's main switch statement. It may be a map state trigger, like a day/night cycle change or a boss warning.
-   **Payload**: `[state: number]`
-   **Example**: `["7", [0]]`
-   **Frequency**: Moderate (periodically).

### `8`
-   **Name**: Player Hit Effect?
-   **Description**: Occurs frequently when attacking something. Contains coordinates. Possibly spawns the visual "hit" particle effect.
-   **Payload**: `[x: number, y: number, size: number, type: number]`

### `V`
-   **Name**: Ability State Update?
-   **Description**: Unclear. The payload is an array of numbers. Could be related to ability cooldowns or available upgrades.
-   **Payload**: `[data: number[]]` or `[[data: number[]], unknown: number]`

### `Y`
-   **Name**: Projectile Distance?
-   **Description**: Sent after `X` (Create Projectile). The second number might represent distance traveled or time until impact.
-   **Payload**: `[unknown: number, value: number]`

### `Z`
-   **Name**: Game Elapsed?
-   **Description**: Seemingly, a game elapsed clock - just constantly goes down, each second.
-   **Payload**: `[timeElapsed: number]`
-   **Example**: `["0", [-407063]]`
-   **Frequency**: Moderate (every second).