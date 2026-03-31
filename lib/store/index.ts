// ═══════════════════════════════════════════════════════════════
// IN-MEMORY STORE
// Holds all runtime state with debounced JSON persistence
// Singleton pattern for shared access across API routes
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { logger } from "@/lib/logger";
import type { StoreState, PnlSnapshot, ErrorRecord } from "./types";
import type { TruthPost } from "@/lib/monitor/types";
import type { Analysis } from "@/lib/analyzer/types";
import type { TradeRecord } from "@/lib/trader/types";

const MODULE = "Store";
const DATA_DIR = join(process.cwd(), "data");
const STORE_FILE = join(DATA_DIR, "store.json");
const MAX_POSTS = 200;
const MAX_ANALYSES = 200;
const MAX_ERRORS = 100;
const DEBOUNCE_MS = 500;

function defaultState(): StoreState {
  return {
    posts: [],
    analyses: [],
    trades: [],
    pnl: [],
    errors: [],
    lastPollAt: null,
    dailyLoss: 0,
    tradingHalted: false,
  };
}

class Store {
  private state: StoreState;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = this.load();
  }

  private load(): StoreState {
    try {
      if (existsSync(STORE_FILE)) {
        const raw = readFileSync(STORE_FILE, "utf-8");
        const data = JSON.parse(raw);
        logger.info(MODULE, `Loaded ${data.posts?.length || 0} posts, ${data.trades?.length || 0} trades from disk`);
        return { ...defaultState(), ...data };
      }
    } catch (err) {
      logger.error(MODULE, `Failed to load store: ${err}`);
    }
    return defaultState();
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), DEBOUNCE_MS);
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2));
    } catch (err) {
      logger.error(MODULE, `Failed to save store: ${err}`);
    }
  }

  // ─── Posts ─────────────────────────────────────────────────

  addPost(post: TruthPost) {
    this.state.posts.unshift(post);
    if (this.state.posts.length > MAX_POSTS) {
      this.state.posts = this.state.posts.slice(0, MAX_POSTS);
    }
    this.scheduleSave();
  }

  getPosts(limit = 50): TruthPost[] {
    return this.state.posts.slice(0, limit);
  }

  // ─── Analyses ──────────────────────────────────────────────

  addAnalysis(analysis: Analysis) {
    this.state.analyses.unshift(analysis);
    if (this.state.analyses.length > MAX_ANALYSES) {
      this.state.analyses = this.state.analyses.slice(0, MAX_ANALYSES);
    }
    this.scheduleSave();
  }

  getAnalyses(limit = 50): Analysis[] {
    return this.state.analyses.slice(0, limit);
  }

  getAnalysisForPost(postId: string): Analysis | undefined {
    return this.state.analyses.find((a) => a.postId === postId);
  }

  // ─── Trades ────────────────────────────────────────────────

  addTrade(trade: TradeRecord) {
    this.state.trades.unshift(trade);
    this.scheduleSave();
  }

  getTrades(limit = 50): TradeRecord[] {
    return this.state.trades.slice(0, limit);
  }

  // ─── P&L ──────────────────────────────────────────────────

  addPnlSnapshot(snapshot: PnlSnapshot) {
    this.state.pnl.push(snapshot);
    this.scheduleSave();
  }

  getPnlHistory(): PnlSnapshot[] {
    return this.state.pnl;
  }

  // ─── Errors ────────────────────────────────────────────────

  addError(error: ErrorRecord) {
    this.state.errors.unshift(error);
    if (this.state.errors.length > MAX_ERRORS) {
      this.state.errors = this.state.errors.slice(0, MAX_ERRORS);
    }
    this.scheduleSave();
  }

  getErrors(limit = 20): ErrorRecord[] {
    return this.state.errors.slice(0, limit);
  }

  // ─── Full State ────────────────────────────────────────────

  getState(): StoreState {
    return { ...this.state };
  }

  setTradingHalted(halted: boolean) {
    this.state.tradingHalted = halted;
    this.scheduleSave();
  }

  updateLastPollAt(timestamp: string) {
    this.state.lastPollAt = timestamp;
  }
}

// Singleton
const globalForStore = globalThis as unknown as { store: Store };
export const store = globalForStore.store || new Store();
if (process.env.NODE_ENV !== "production") globalForStore.store = store;
