// ═══════════════════════════════════════════════════════════════
// EVENT BUS
// Simple pub/sub for server-side event broadcasting to SSE clients
// ═══════════════════════════════════════════════════════════════

type EventHandler = (data: unknown) => void;

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown) {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (e) {
        console.error(`EventBus handler error for ${event}:`, e);
      }
    });
    // Also emit to wildcard listeners
    this.handlers.get("*")?.forEach((handler) => {
      try {
        handler({ event, data });
      } catch (e) {
        console.error(`EventBus wildcard handler error:`, e);
      }
    });
  }
}

// Singleton
const globalForBus = globalThis as unknown as { eventBus: EventBus };
export const eventBus = globalForBus.eventBus || new EventBus();
if (process.env.NODE_ENV !== "production") globalForBus.eventBus = eventBus;
