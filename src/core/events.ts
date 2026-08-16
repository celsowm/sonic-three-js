export type EventListener<Payload> = (payload: Payload) => void;

/**
 * Minimal typed event emitter. Listeners may safely subscribe or
 * unsubscribe while an event is being emitted.
 */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<never>>>();

  public on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    let eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      eventListeners = new Set();
      this.listeners.set(event, eventListeners);
    }
    eventListeners.add(listener as EventListener<never>);
    return () => this.off(event, listener);
  }

  public off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as EventListener<never>);
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    for (const listener of [...eventListeners]) {
      (listener as EventListener<Events[K]>)(payload);
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
