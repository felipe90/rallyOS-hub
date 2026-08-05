/**
 * FlowModeRegistry tests — rule engine resolution (FMR-1).
 *
 * Mirrors SportRegistry: a factory map with lazy instance caching, and an
 * UNKNOWN_MODE throw for unregistered modes. `registerDefaultFlows()` ships
 * the club + tournament contracts.
 */
import { FlowModeRegistry } from './FlowModeRegistry';
import { registerDefaultFlows } from './index';
import { ClubFlowContract } from './ClubFlowContract';
import { TournamentFlowContract } from './TournamentFlowContract';

describe('FlowModeRegistry', () => {
  it('throws UNKNOWN_MODE for an unregistered mode', () => {
    const registry = new FlowModeRegistry();
    expect(() => registry.get('club')).toThrow('Unknown flow mode: club');
    expect(() => registry.get('tournament')).toThrow('Unknown flow mode: tournament');
  });

  it('resolves a registered contract via its factory (lazy, cached instance)', () => {
    const registry = new FlowModeRegistry();
    const factory = jest.fn(() => new ClubFlowContract());
    registry.register('club', factory);

    const contract = registry.get('club');
    expect(contract).toBeInstanceOf(ClubFlowContract);
    expect(factory).toHaveBeenCalledTimes(1);

    // Cached — a second get() must NOT re-invoke the factory.
    expect(registry.get('club')).toBe(contract);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('re-registering a mode replaces the factory and invalidates the cached instance', () => {
    const registry = new FlowModeRegistry();
    registry.register('club', () => new ClubFlowContract());
    registry.get('club');

    const replacement = jest.fn(() => new TournamentFlowContract());
    registry.register('club', replacement);

    expect(registry.get('club')).toBeInstanceOf(TournamentFlowContract);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('has() reflects registered modes', () => {
    const registry = new FlowModeRegistry();
    expect(registry.has('club')).toBe(false);
    expect(registry.has('tournament')).toBe(false);
    registry.register('tournament', () => new TournamentFlowContract());
    expect(registry.has('tournament')).toBe(true);
    expect(registry.has('club')).toBe(false);
  });
});

describe('registerDefaultFlows', () => {
  it('registers both default flow modes', () => {
    const registry = registerDefaultFlows();
    expect(registry.get('club')).toBeInstanceOf(ClubFlowContract);
    expect(registry.get('tournament')).toBeInstanceOf(TournamentFlowContract);
  });
});
