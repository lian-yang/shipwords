import { describe, expect, it } from 'vitest';
import { generationPollDelay } from '../src/react';

describe('generation and settlement polling', () => {
  it('checks generating jobs promptly', () => {
    expect(generationPollDelay({ status: 'queued', settlement: 'not_applicable' })).toBe(2500);
    expect(generationPollDelay({ status: 'submitted', settlement: 'not_applicable' })).toBe(2500);
  });

  it.each(['failed', 'canceled'] as const)(
    'keeps checking %s jobs while billing is pending, then stops when settled',
    (status) => {
      expect(generationPollDelay({ status, settlement: 'pending' })).toBe(30_000);
      expect(generationPollDelay({ status, settlement: 'refunded' })).toBeNull();
      expect(generationPollDelay({ status, settlement: 'charged' })).toBeNull();
    },
  );

  it('does not poll completed or free jobs after they end', () => {
    expect(generationPollDelay({ status: 'succeeded', settlement: 'not_applicable' })).toBeNull();
    expect(generationPollDelay({ status: 'failed', settlement: 'not_applicable' })).toBeNull();
  });
});
