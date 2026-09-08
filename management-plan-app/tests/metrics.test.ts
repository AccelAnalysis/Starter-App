import { describe, expect, it } from 'vitest';
import { operationalMetrics } from '../lib/metrics';
import { execute } from '../lib/domain';
import { viewFor } from '../lib/policy';
import { fixture, person, alicePlan, testTime } from './fixture';
describe('Operational measurement cohorts', () => {
  it('does not count a future scheduled review as a reviewed current plan', () => { const s = fixture(); const metric = operationalMetrics(viewFor(s, person(s, 'admin')), '2026-09-07').find(m => m[0] === 'Reviewed & current plans')!; expect(metric[1]).toBe(0); expect(metric[2]).toBe(2); });
  it('includes early completions in the denominator and uses the local completion date', () => { let s = fixture(); const actor = person(s, 'manager').id; const p = alicePlan(s); s = execute(s, actor, { type: 'review.schedule', payload: { planId: p.id, scheduledFor: '2026-09-08' } }, testTime); s = execute(s, actor, { type: 'review.complete', payload: { id: s.reviews[0].id, outcome: 'no_change', decision: 'Continue.', nextReview: '2026-09-14' } }, '2026-09-08T00:30:00.000Z'); const metric = operationalMetrics(viewFor(s, person(s, 'admin')), '2026-09-07').find(m => m[0] === 'Reviews on time')!; expect(metric[1]).toBe(1); expect(metric[2]).toBe(1); });
  it('keeps every numerator within its denominator', () => { const s = fixture(); const metrics = operationalMetrics(viewFor(s, person(s, 'admin')), '2026-09-07'); expect(metrics.every(([, n, total]) => n >= 0 && n <= total)).toBe(true); });
});
