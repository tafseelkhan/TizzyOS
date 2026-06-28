/**
 * Ads Event Emitter - Central event system
 *
 * @module AdsEventEmitter
 */

type EventListener = (...args: any[]) => void;

/**
 * Event Emitter for Ads SDK
 */
class AdsEventEmitterClass {
  private _events: Map<string, EventListener[]> = new Map();
  private _onceEvents: Map<string, EventListener[]> = new Map();

  /**
   * Subscribe to an event
   */
  public on(event: string, listener: EventListener): () => void {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event)!.push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Subscribe to an event once
   */
  public once(event: string, listener: EventListener): () => void {
    if (!this._onceEvents.has(event)) {
      this._onceEvents.set(event, []);
    }
    this._onceEvents.get(event)!.push(listener);

    return () => {
      const listeners = this._onceEvents.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe from an event
   */
  public off(event: string, listener: EventListener): void {
    const listeners = this._events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }

    const onceListeners = this._onceEvents.get(event);
    if (onceListeners) {
      const index = onceListeners.indexOf(listener);
      if (index > -1) {
        onceListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  public emit(event: string, ...args: any[]): void {
    // Regular listeners
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(
            `[AdsEventEmitter] Error in listener for ${event}:`,
            error,
          );
        }
      });
    }

    // Once listeners
    const onceListeners = this._onceEvents.get(event);
    if (onceListeners) {
      const toRemove = [...onceListeners];
      this._onceEvents.delete(event);
      toRemove.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(
            `[AdsEventEmitter] Error in once listener for ${event}:`,
            error,
          );
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this._events.delete(event);
      this._onceEvents.delete(event);
    } else {
      this._events.clear();
      this._onceEvents.clear();
    }
  }
}

export const AdsEventEmitter = new AdsEventEmitterClass();
export default AdsEventEmitter;
