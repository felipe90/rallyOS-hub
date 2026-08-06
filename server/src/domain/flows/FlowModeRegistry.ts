/**
 * FlowModeRegistry — resolves the flow contract per mode (FMR-1).
 *
 * Mirrors SportRegistry (domain/sports/sport.registry.ts): a factory map with
 * lazy singleton caching. Registering a new mode (`clase`, future) is one
 * `register(key, factory)` call — CourtManager never branches (FMR-1 scenario).
 *
 * Usage:
 *   const registry = new FlowModeRegistry();
 *   registry.register('club', () => new ClubFlowContract());
 *   const contract = registry.get('club');
 *
 * `get()` throws `Unknown flow mode: <key>` for unregistered modes.
 */

import type { FlowModeContract } from './FlowModeContract';
import type { FlowModeKey } from '../types';

export class FlowModeRegistry {
  /** Cached contract instances — factories run at most once per mode. */
  private instances = new Map<FlowModeKey, FlowModeContract>();
  /** Factory functions: mode → () => FlowModeContract. */
  private factories = new Map<FlowModeKey, () => FlowModeContract>();

  /**
   * Register (or override) a mode with its contract factory.
   * Clears any cached instance so the next get() calls the new factory.
   */
  register(key: FlowModeKey, factory: () => FlowModeContract): this {
    this.factories.set(key, factory);
    this.instances.delete(key);
    return this;
  }

  /** Get the flow contract for a mode; lazily instantiates and caches. */
  get(key: FlowModeKey): FlowModeContract {
    const cached = this.instances.get(key);
    if (cached) return cached;

    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Unknown flow mode: ${key}`);
    }

    const instance = factory();
    this.instances.set(key, instance);
    return instance;
  }

  /** Whether a mode is registered (factory present or instance cached). */
  has(key: FlowModeKey): boolean {
    return this.factories.has(key) || this.instances.has(key);
  }
}
