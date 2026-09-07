import { describe, expect, it } from 'vitest';
import { execute } from '../lib/domain';
import { readsRef, viewFor } from '../lib/policy';
import { fixture, person, alicePlan, testTime } from './fixture';
describe('Executive review agenda confidentiality', () => {
  it('does not expose an executive-only agenda through a linked meeting', () => {
    let s = fixture();
    s = execute(s, person(s, 'admin').id, { type: 'review.schedule', payload: { planId: alicePlan(s).id, reviewerId: person(s, 'admin').id, subjectId: person(s, 'alice').id, scheduledFor: '2026-09-14', visibility: 'leadership', agenda: 'EXECUTIVE PRIVATE AGENDA' } }, testTime);
    const meeting = s.meetings[0];
    expect(readsRef(s, person(s, 'alice'), 'meeting', meeting.id)).toBe(false);
    expect(readsRef(s, person(s, 'manager'), 'meeting', meeting.id)).toBe(false);
    expect(readsRef(s, person(s, 'admin'), 'meeting', meeting.id)).toBe(true);
    expect(JSON.stringify(viewFor(s, person(s, 'alice')))).not.toContain('EXECUTIVE PRIVATE AGENDA');
    expect(JSON.stringify(viewFor(s, person(s, 'manager')))).not.toContain('EXECUTIVE PRIVATE AGENDA');
  });
  it('retains ordinary private check-in agenda access for its employee subject', () => {
    let s = fixture();
    s = execute(s, person(s, 'manager').id, { type: 'review.schedule', payload: { planId: alicePlan(s).id, scheduledFor: '2026-09-14', visibility: 'private', agenda: 'Agreed employee check-in agenda.' } }, testTime);
    expect(readsRef(s, person(s, 'alice'), 'meeting', s.meetings[0].id)).toBe(true);
    expect(readsRef(s, person(s, 'bob'), 'meeting', s.meetings[0].id)).toBe(false);
  });
});
