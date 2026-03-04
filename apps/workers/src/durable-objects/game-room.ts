/**
 * Game Room Durable Object
 *
 * Manages real-time game state synchronization using Yjs CRDTs.
 * Each room is identified by user's Bitcoin address.
 *
 * Features:
 * - WebSocket connections for real-time sync
 * - Yjs document for CRDT-based state
 * - Persistent storage in SQLite
 * - Cross-device synchronization
 */

import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import type { Env, ApiResponse, GameState } from "../lib/types";
import { gameLogger } from "../lib/logger";

// WebSocket connection with metadata
interface Connection {
  webSocket: WebSocket;
  clientId: string;
  connectedAt: number;
}

export class GameRoomDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private roomId: string | null = null;
  private ydoc: Y.Doc;
  private connections: Map<string, Connection> = new Map();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // OPTIMIZATION: Track if state is already loaded to prevent repeated DB reads
  private stateLoaded: boolean = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ydoc = new Y.Doc();

    // Initialize
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });

    // Set up Yjs update handler
    this.ydoc.on("update", (update: Uint8Array) => {
      this.broadcastUpdate(update);
      this.scheduleSave();
    });
  }

  /**
   * Initialize SQLite schema
   */
  private async initializeSchema(): Promise<void> {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS game_state (
        room_id TEXT PRIMARY KEY,
        yjs_state BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_sync_log_room
      ON sync_log(room_id, timestamp)
    `);
  }

  /**
   * Load Yjs state from storage
   * OPTIMIZATION: Only load once per DO instance
   */
  private loadState(): void {
    if (!this.roomId) return;

    // Skip if already loaded for this room
    if (this.stateLoaded) return;

    const rows = this.sql
      .exec("SELECT yjs_state FROM game_state WHERE room_id = ?", this.roomId)
      .toArray();

    if (rows.length > 0 && rows[0].yjs_state) {
      const state = rows[0].yjs_state as ArrayBuffer;
      Y.applyUpdate(this.ydoc, new Uint8Array(state));
      gameLogger.debug("Loaded state", { roomId: this.roomId });
    } else {
      // Initialize default game state
      this.initializeDefaultState();
    }

    this.stateLoaded = true;
  }

  /**
   * Initialize default game state for new users
   */
  private initializeDefaultState(): void {
    const gameState = this.ydoc.getMap("gameState");

    if (gameState.size === 0) {
      gameState.set("level", 1);
      gameState.set("xp", 0);
      gameState.set("xpToNextLevel", 100);
      gameState.set("stage", "egg");
      gameState.set("name", "Baby");

      const stats = new Y.Map();
      stats.set("energy", 100);
      stats.set("happiness", 100);
      stats.set("hunger", 100);
      stats.set("health", 100);
      gameState.set("stats", stats);

      const achievements = new Y.Array();
      gameState.set("achievements", achievements);

      gameState.set("totalHashes", 0);
      gameState.set("totalShares", 0);
      gameState.set("lastSyncAt", Date.now());

      gameLogger.debug("Initialized default state", { roomId: this.roomId });
    }
  }

  /**
   * Save Yjs state to storage (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveState();
    }, 1000); // Debounce saves by 1 second
  }

  /**
   * Save state immediately
   */
  private saveState(): void {
    if (!this.roomId) return;

    const state = Y.encodeStateAsUpdate(this.ydoc);
    const now = Date.now();

    this.sql.exec(
      `INSERT INTO game_state (room_id, yjs_state, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(room_id) DO UPDATE SET
         yjs_state = excluded.yjs_state,
         updated_at = excluded.updated_at`,
      this.roomId,
      state.buffer,
      now,
      now,
    );

    gameLogger.debug("Saved state", { roomId: this.roomId });
  }

  /**
   * Broadcast Yjs update to all connected clients
   */
  private broadcastUpdate(update: Uint8Array): void {
    const message = JSON.stringify({
      type: "yjs-update",
      data: Array.from(update),
    });

    for (const [clientId, conn] of this.connections) {
      try {
        conn.webSocket.send(message);
      } catch (error) {
        gameLogger.error("Failed to send to client", error, { clientId });
        this.connections.delete(clientId);
      }
    }
  }

  /**
   * Log sync action
   * OPTIMIZATION: Disabled to reduce rows_write
   * Uncomment for debugging if needed
   */
  private logSyncAction(_clientId: string, _action: string): void {
    // Disabled to reduce DB writes and stay under free tier limits
    // Only enable for debugging:
    // if (!this.roomId) return;
    // this.sql.exec(
    //   `INSERT INTO sync_log (room_id, client_id, action, timestamp)
    //    VALUES (?, ?, ?, ?)`,
    //   this.roomId,
    //   _clientId,
    //   _action,
    //   Date.now(),
    // );
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Extract room ID from path: /game/{roomId}/...
      const pathParts = path.split("/").filter(Boolean);
      if (pathParts.length < 2 || pathParts[0] !== "game") {
        return this.errorResponse("Invalid path", 400);
      }

      this.roomId = pathParts[1];
      this.loadState();

      const action = pathParts[2] || "connect";

      // WebSocket upgrade
      if (request.headers.get("Upgrade") === "websocket") {
        return this.handleWebSocket();
      }

      // HTTP endpoints
      switch (action) {
        case "state":
          return this.handleGetState();
        case "achievements":
          if (request.method === "POST") {
            return this.handleUpdateAchievements(request);
          }
          if (request.method === "GET") {
            return this.handleGetAchievements();
          }
          break;
        case "reset":
          if (request.method === "POST") {
            return this.handleReset();
          }
          break;
      }

      return this.errorResponse("Not found", 404);
    } catch (error) {
      gameLogger.error("Request error", error);
      return this.errorResponse(
        error instanceof Error ? error.message : "Internal error",
        500,
      );
    }
  }

  /**
   * Handle WebSocket connection
   */
  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const clientId = crypto.randomUUID();

    // Accept the WebSocket
    this.ctx.acceptWebSocket(server);

    // Store connection
    this.connections.set(clientId, {
      webSocket: server,
      clientId,
      connectedAt: Date.now(),
    });

    this.logSyncAction(clientId, "connected");

    // Set up message handler
    server.addEventListener("message", (event) => {
      this.handleWebSocketMessage(clientId, event.data as string);
    });

    // Set up close handler
    server.addEventListener("close", () => {
      this.connections.delete(clientId);
      this.logSyncAction(clientId, "disconnected");
      gameLogger.debug("Client disconnected", { clientId });
    });

    // Set up error handler
    server.addEventListener("error", (event) => {
      gameLogger.error("WebSocket error", undefined, {
        clientId,
        message: event instanceof ErrorEvent ? event.message : "Unknown error",
      });
      this.connections.delete(clientId);
    });

    // Send initial state
    const state = Y.encodeStateAsUpdate(this.ydoc);
    server.send(
      JSON.stringify({
        type: "yjs-sync",
        data: Array.from(state),
        clientId,
      }),
    );

    gameLogger.info("Client connected", { clientId, roomId: this.roomId });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(clientId: string, data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "yjs-update": {
          // Apply update from client
          const update = new Uint8Array(message.data);
          Y.applyUpdate(this.ydoc, update);
          this.logSyncAction(clientId, "update");
          break;
        }

        case "ping": {
          // Respond with pong
          const conn = this.connections.get(clientId);
          if (conn) {
            conn.webSocket.send(JSON.stringify({ type: "pong" }));
          }
          break;
        }

        case "get-state": {
          // Send current state
          const conn = this.connections.get(clientId);
          if (conn) {
            const state = Y.encodeStateAsUpdate(this.ydoc);
            conn.webSocket.send(
              JSON.stringify({
                type: "yjs-sync",
                data: Array.from(state),
              }),
            );
          }
          break;
        }
      }
    } catch (error) {
      gameLogger.error("Failed to handle message", error, { clientId });
    }
  }

  /**
   * GET /game/{roomId}/state - Get current state as JSON
   */
  private handleGetState(): Response {
    const gameState = this.ydoc.getMap("gameState");

    // Convert Yjs types to plain objects
    const stats = gameState.get("stats") as Y.Map<number> | undefined;
    const achievements = gameState.get("achievements") as
      | Y.Array<string>
      | undefined;

    const state: GameState = {
      level: (gameState.get("level") as number) || 1,
      xp: (gameState.get("xp") as number) || 0,
      xpToNextLevel: (gameState.get("xpToNextLevel") as number) || 100,
      stage: (gameState.get("stage") as string) || "egg",
      name: (gameState.get("name") as string) || "Baby",
      stats: stats
        ? {
            energy: stats.get("energy") || 100,
            happiness: stats.get("happiness") || 100,
            hunger: stats.get("hunger") || 100,
            health: stats.get("health") || 100,
          }
        : {
            energy: 100,
            happiness: 100,
            hunger: 100,
            health: 100,
          },
      achievements: achievements ? achievements.toArray() : [],
      totalHashes: (gameState.get("totalHashes") as number) || 0,
      totalShares: (gameState.get("totalShares") as number) || 0,
      lastSyncAt: (gameState.get("lastSyncAt") as number) || Date.now(),
    };

    const response: ApiResponse<GameState> = {
      success: true,
      data: state,
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /game/{roomId}/reset - Reset game state
   */
  private handleReset(): Response {
    // Clear Yjs document
    this.ydoc.destroy();
    this.ydoc = new Y.Doc();

    // Reinitialize default state
    this.initializeDefaultState();

    // Save immediately
    this.saveState();

    // Broadcast reset to all clients
    const state = Y.encodeStateAsUpdate(this.ydoc);
    for (const [, conn] of this.connections) {
      try {
        conn.webSocket.send(
          JSON.stringify({
            type: "yjs-sync",
            data: Array.from(state),
            reset: true,
          }),
        );
      } catch {
        // Ignore send errors
      }
    }

    this.logSyncAction("system", "reset");

    const response: ApiResponse<{ reset: boolean }> = {
      success: true,
      data: { reset: true },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * GET /game/{roomId}/achievements - Get achievement list
   */
  private handleGetAchievements(): Response {
    const gameState = this.ydoc.getMap("gameState");
    const achievements = gameState.get("achievements") as
      | Y.Array<string>
      | undefined;

    const response: ApiResponse<{ achievements: string[] }> = {
      success: true,
      data: {
        achievements: achievements ? achievements.toArray() : [],
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /game/{roomId}/achievements - Add new achievements
   *
   * Body: { achievements: string[] }
   * Adds achievements to the list if not already present.
   */
  private async handleUpdateAchievements(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      achievements: string[];
    };

    if (!Array.isArray(body.achievements)) {
      return this.errorResponse("achievements must be an array", 400);
    }

    const gameState = this.ydoc.getMap("gameState");
    let achievements = gameState.get("achievements") as Y.Array<string>;

    if (!achievements) {
      achievements = new Y.Array();
      gameState.set("achievements", achievements);
    }

    // Get current achievements as Set for quick lookup
    const currentSet = new Set(achievements.toArray());
    const added: string[] = [];

    // Add new achievements
    for (const achievement of body.achievements) {
      if (typeof achievement === "string" && !currentSet.has(achievement)) {
        achievements.push([achievement]);
        currentSet.add(achievement);
        added.push(achievement);
      }
    }

    // Broadcast update to all connected clients
    if (added.length > 0) {
      const state = Y.encodeStateAsUpdate(this.ydoc);
      for (const [, conn] of this.connections) {
        try {
          conn.webSocket.send(
            JSON.stringify({
              type: "yjs-sync",
              data: Array.from(state),
            }),
          );
        } catch {
          // Ignore send errors
        }
      }
    }

    const response: ApiResponse<{
      added: string[];
      total: number;
    }> = {
      success: true,
      data: {
        added,
        total: achievements.length,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * Helper to create error response
   */
  private errorResponse(message: string, status: number): Response {
    const response: ApiResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
    return Response.json(response, { status });
  }

  /**
   * Handle WebSocket hibernation wake
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    // Find client ID for this WebSocket
    let clientId: string | null = null;
    for (const [id, conn] of this.connections) {
      if (conn.webSocket === ws) {
        clientId = id;
        break;
      }
    }

    if (clientId && typeof message === "string") {
      this.handleWebSocketMessage(clientId, message);
    }
  }

  /**
   * Handle WebSocket close during hibernation
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    for (const [clientId, conn] of this.connections) {
      if (conn.webSocket === ws) {
        this.connections.delete(clientId);
        this.logSyncAction(clientId, "disconnected");
        gameLogger.debug("Client disconnected (hibernation)", { clientId });
        break;
      }
    }
  }
}
