import { describe, expect, it } from 'vitest';
import { execute } from '../lib/domain';
import { viewFor } from '../lib/policy';
import { fixture, member } from './fixture';

describe('Management v2 domain', () => {
  it('lets an administrator create a manager and an employee reporting relationship', () => {
    let state = fixture();
    state = execute(state, 'admin', { type: 'member.save', payload: { email: 'new-manager@example.test', name: 'New Manager', role: 'manager', notifyEmail: true } }, '2026-09-08T00:00:00.000Z');
    const manager = state.members.find(m => m.email === 'new-manager@example.test')!;
    expect(manager.managerId).toBe('admin');
    state = execute(state, 'admin', { type: 'member.save', payload: { email: 'new-employee@example.test', name: 'New Employee', role: 'employee', managerId: manager.id, notifyEmail: true } }, '2026-09-08T00:01:00.000Z');
    expect(state.members.find(m => m.email === 'new-employee@example.test')?.managerId).toBe(manager.id);
  });

  it('requires every initiative to start with at least one KPI', () => {
    const state = fixture();
    expect(() => execute(state, 'manager', { type: 'initiative.create', payload: { ownerId: 'alice', title: 'No measure', description: 'This should not be accepted.', kpis: [] } }, '2026-09-08T00:00:00.000Z')).toThrow('Every initiative must start');
  });

  it('lets a manager create a multi-KPI initiative for a direct report and queues both notification channels', () => {
    const state = execute(fixture(), 'manager', {
      type: 'initiative.create',
      payload: {
        ownerId: 'alice',
        title: 'Improve retention',
        description: 'Improve renewal behavior and service response.',
        kpis: [
          { name: 'Renewal rate', unit: '%', target: 90 },
          { name: 'Response time', unit: 'hours', target: 4, direction: 'at_most' }
        ]
      }
    }, '2026-09-08T00:00:00.000Z');
    const initiative = state.initiatives.find(i => i.title === 'Improve retention')!;
    expect(state.kpis.filter(k => k.initiativeId === initiative.id)).toHaveLength(2);
    expect(state.notifications.filter(n => n.initiativeId === initiative.id).map(n => n.channel).sort()).toEqual(['email', 'sms']);
  });

  it('rejects cross-manager assignment', () => {
    expect(() => execute(fixture(), 'manager2', { type: 'initiative.create', payload: { ownerId: 'alice', title: 'Wrong reporting line', description: 'Must be denied.', kpis: [{ name: 'Measure', unit: '%', target: 100 }] } }, '2026-09-08T00:00:00.000Z')).toThrow('cannot assign');
  });

  it('lets an employee update their own KPI and notifies their manager by email and SMS', () => {
    const state = execute(fixture(), 'alice', { type: 'kpi.update', payload: { id: 'kpi-opportunities', current: 9, status: 'on_track', note: 'Two new qualified opportunities.' } }, '2026-09-08T00:00:00.000Z');
    expect(state.kpis.find(k => k.id === 'kpi-opportunities')?.current).toBe(9);
    expect(state.updates).toHaveLength(1);
    expect(state.notifications.map(n => n.channel).sort()).toEqual(['email', 'sms']);
    expect(() => execute(fixture(), 'charlie', { type: 'kpi.update', payload: { id: 'kpi-opportunities', current: 99, status: 'on_track' } }, '2026-09-08T00:00:00.000Z')).toThrow('cannot update');
  });

  it('creates two-way message notifications to the other side', () => {
    let state = execute(fixture(), 'alice', { type: 'message.create', payload: { initiativeId: 'initiative-alice', text: 'Can we review the new lead source?' } }, '2026-09-08T00:00:00.000Z');
    expect(state.notifications.filter(n => n.memberId === 'manager')).toHaveLength(2);
    state = execute(state, 'manager', { type: 'message.create', payload: { initiativeId: 'initiative-alice', text: 'Yes. Bring the conversion data.' } }, '2026-09-08T00:01:00.000Z');
    expect(state.notifications.filter(n => n.memberId === 'alice').map(n => n.channel).sort()).toEqual(['email', 'sms']);
  });

  it('isolates peer and cross-reporting-line views', () => {
    const state = fixture();
    const bobView = viewFor(state, member(state, 'bob'));
    expect(bobView.initiatives.some(i => i.id === 'initiative-alice')).toBe(false);
    expect(bobView.messages.some(m => m.initiativeId === 'initiative-alice')).toBe(false);
    const charlieView = viewFor(state, member(state, 'charlie'));
    expect(charlieView.initiatives).toHaveLength(0);
  });

  it('does not leak another employee notification through a manager recipient', () => {
    const base = fixture();
    base.notifications.push({ id: 'private-note', memberId: 'manager', initiativeId: 'initiative-alice', sourceType: 'message', sourceId: 'message-one', channel: 'email', subject: 'Alice private context', body: 'PRIVATE ALICE MANAGEMENT CONTENT', status: 'queued', createdAt: '2026-09-08T00:00:00.000Z' });
    const bobView = viewFor(base, member(base, 'bob'));
    expect(JSON.stringify(bobView)).not.toContain('PRIVATE ALICE MANAGEMENT CONTENT');
  });

  it('requires every KPI to be complete before closing an initiative', () => {
    expect(() => execute(fixture(), 'manager', { type: 'initiative.update', payload: { id: 'initiative-alice', state: 'completed' } }, '2026-09-08T00:00:00.000Z')).toThrow('Complete every KPI');
    let state = execute(fixture(), 'manager', { type: 'kpi.update', payload: { id: 'kpi-opportunities', current: 10, status: 'complete' } }, '2026-09-08T00:00:00.000Z');
    state = execute(state, 'manager', { type: 'kpi.update', payload: { id: 'kpi-conversion', current: 27, status: 'complete' } }, '2026-09-08T00:01:00.000Z');
    state = execute(state, 'manager', { type: 'initiative.update', payload: { id: 'initiative-alice', state: 'completed' } }, '2026-09-08T00:02:00.000Z');
    expect(state.initiatives.find(i => i.id === 'initiative-alice')?.state).toBe('completed');
  });
});
