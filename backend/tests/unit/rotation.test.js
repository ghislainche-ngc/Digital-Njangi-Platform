'use strict';

const RotationStrategy = require('../../src/services/rotation/RotationStrategy');
const FixedRotationStrategy = require('../../src/services/rotation/FixedRotationStrategy');
const RandomDrawStrategy = require('../../src/services/rotation/RandomDrawStrategy');
const PresidentDecisionStrategy = require('../../src/services/rotation/PresidentDecisionStrategy');
const RotationEngine = require('../../src/services/rotation/RotationEngine');

const MEMBERS = [
  { user_id: 'u1', rotation_position: 1 },
  { user_id: 'u2', rotation_position: 2 },
  { user_id: 'u3', rotation_position: 3 },
  { user_id: 'u4', rotation_position: 4 },
  { user_id: 'u5', rotation_position: 5 },
];

describe('RotationStrategy (abstract)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new RotationStrategy()).toThrow('abstract');
  });
});

describe('FixedRotationStrategy', () => {
  it('cycle 1 → member at position 1', () => {
    const strategy = new FixedRotationStrategy(1);
    const result = strategy.selectNextRecipient(MEMBERS, []);
    expect(result.user_id).toBe('u1');
  });

  it('cycle 3 → member at position 3', () => {
    const strategy = new FixedRotationStrategy(3);
    const result = strategy.selectNextRecipient(MEMBERS, []);
    expect(result.user_id).toBe('u3');
  });

  it('cycle 6 wraps → member at position 1', () => {
    const strategy = new FixedRotationStrategy(6);
    const result = strategy.selectNextRecipient(MEMBERS, []);
    expect(result.user_id).toBe('u1');
  });
});

describe('RandomDrawStrategy', () => {
  it('excludes members who already received a payout', () => {
    const strategy = new RandomDrawStrategy();
    const history = [{ recipient_id: 'u1' }, { recipient_id: 'u2' }];
    const result = strategy.selectNextRecipient(MEMBERS, history);
    expect(['u3', 'u4', 'u5']).toContain(result.user_id);
  });

  it('returns null when all members have received', () => {
    const strategy = new RandomDrawStrategy();
    const history = MEMBERS.map(m => ({ recipient_id: m.user_id }));
    const result = strategy.selectNextRecipient(MEMBERS, history);
    expect(result).toBeNull();
  });

  it('distributes fairly over many draws', () => {
    const strategy = new RandomDrawStrategy();
    const counts = {};
    for (let i = 0; i < 5000; i++) {
      const result = strategy.selectNextRecipient(MEMBERS, []);
      counts[result.user_id] = (counts[result.user_id] || 0) + 1;
    }
    // Each member should be selected ~20% of the time; allow ±10% tolerance
    MEMBERS.forEach(m => {
      expect(counts[m.user_id]).toBeGreaterThan(750);
      expect(counts[m.user_id]).toLessThan(1250);
    });
  });
});

describe('PresidentDecisionStrategy', () => {
  it('returns null (awaiting nomination)', () => {
    const strategy = new PresidentDecisionStrategy();
    const result = strategy.selectNextRecipient(MEMBERS, []);
    expect(result).toBeNull();
  });
});

describe('RotationEngine', () => {
  it('delegates to injected strategy', () => {
    const mockStrategy = { selectNextRecipient: jest.fn().mockReturnValue(MEMBERS[0]) };
    const engine = new RotationEngine(mockStrategy);
    const result = engine.selectNextRecipient(MEMBERS, []);
    expect(mockStrategy.selectNextRecipient).toHaveBeenCalledWith(MEMBERS, []);
    expect(result).toBe(MEMBERS[0]);
  });
});
