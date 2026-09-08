import { afterEach, describe, expect, it } from 'vitest';
import { notificationDestination, notificationLink } from '../lib/notifications';
import { fixture } from './fixture';

const notification = {
  id: 'n1', memberId: 'alice', initiativeId: 'initiative-alice', sourceType: 'message' as const, sourceId: 'm1', channel: 'email' as const, subject: 'Update', body: 'Body', status: 'queued' as const, createdAt: '2026-09-08T00:00:00.000Z'
};

afterEach(() => { delete process.env.APP_BASE_URL; });

describe('notification addressing', () => {
  it('uses the member email or phone for the selected channel', () => {
    const alice = fixture().members.find(m => m.id === 'alice')!;
    expect(notificationDestination(alice, notification)).toBe('alice@example.test');
    expect(notificationDestination(alice, { ...notification, channel: 'sms' })).toBe('+17575550102');
  });

  it('creates a deep link back to the initiative', () => {
    process.env.APP_BASE_URL = 'https://management.example.com/';
    expect(notificationLink('initiative-alice')).toBe('https://management.example.com/#initiative=initiative-alice');
  });
});
