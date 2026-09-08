import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/workspace/route';
import { services } from '../lib/server';
import { fixture } from './fixture';
import { emulatorEnvironment, seed, token, password } from './emulator';
import type { View } from '../lib/model';

emulatorEnvironment();
let environment: RulesTestEnvironment;
const tokens: Record<string, string> = {};

async function get(who: string) {
  return GET(new NextRequest('http://localhost/api/workspace', { headers: { authorization: `Bearer ${tokens[who]}` } }));
}

async function post(who: string, revision: number, type: string, payload: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/workspace', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' },
    body: JSON.stringify({ revision, command: { type, payload } })
  }));
}

beforeAll(async () => {
  await seed(fixture());
  environment = await initializeTestEnvironment({
    projectId: 'demo-management-v2',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') }
  });
  for (const who of ['admin', 'manager', 'manager2', 'alice', 'bob', 'charlie']) tokens[who] = await token(`${who}@example.test`);
});

afterAll(async () => { await environment?.cleanup(); });

describe('V2 browser data boundary', () => {
  it('denies direct Firestore access for guests and authenticated users', async () => {
    const guest = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'managementV2Workspaces/management-v2')));
    const admin = environment.authenticatedContext('admin-uid', { email: 'admin@example.test', email_verified: true }).firestore();
    await assertFails(getDoc(doc(admin, 'managementV2Workspaces/management-v2')));
    await assertFails(setDoc(doc(admin, 'managementV2Workspaces/management-v2/records/injected'), { admin: true }));
  });

  it('rejects unauthenticated requests', async () => {
    expect((await GET(new NextRequest('http://localhost/api/workspace'))).status).toBe(401);
  });

  it('serves an employee only their reporting context and own initiative', async () => {
    const response = await get('alice');
    expect(response.status).toBe(200);
    const view: View = await response.json();
    expect(view.me.email).toBe('alice@example.test');
    expect(view.initiatives.map(i => i.id)).toEqual(['initiative-alice']);
    expect(view.directory.map(m => m.id).sort()).toEqual(['alice', 'manager']);
  });

  it('persists a manager-created KPI-backed initiative that becomes visible to its owner', async () => {
    let manager: View = await (await get('manager')).json();
    const response = await post('manager', manager.revision, 'initiative.create', {
      ownerId: 'alice',
      title: 'Improve customer experience',
      description: 'Close the loop on every customer follow-up.',
      kpis: [{ name: 'Follow-ups within 24 hours', unit: '%', target: 95 }]
    });
    expect(response.status).toBe(200);
    manager = await response.json();
    const initiative = manager.initiatives.find(i => i.title === 'Improve customer experience')!;
    expect(manager.kpis.filter(k => k.initiativeId === initiative.id)).toHaveLength(1);
    const alice: View = await (await get('alice')).json();
    expect(alice.initiatives.some(i => i.id === initiative.id)).toBe(true);
  });

  it('persists employee KPI update and two-way initiative messages', async () => {
    let alice: View = await (await get('alice')).json();
    let response = await post('alice', alice.revision, 'kpi.update', { id: 'kpi-opportunities', current: 8, status: 'at_risk', note: 'Need one more source of qualified leads.' });
    expect(response.status).toBe(200);
    alice = await response.json();
    let manager: View = await (await get('manager')).json();
    expect(manager.updates.some(u => u.note.includes('qualified leads'))).toBe(true);
    response = await post('manager', manager.revision, 'message.create', { initiativeId: 'initiative-alice', text: 'I will review the partner channel today.' });
    expect(response.status).toBe(200);
    manager = await response.json();
    alice = await (await get('alice')).json();
    expect(alice.messages.some(m => m.text.includes('partner channel'))).toBe(true);
    response = await post('alice', alice.revision, 'message.create', { initiativeId: 'initiative-alice', text: 'Thanks. I will update the KPI tomorrow.' });
    expect(response.status).toBe(200);
  });

  it('enforces peer and cross-manager isolation', async () => {
    const bob: View = await (await get('bob')).json();
    expect(bob.initiatives.some(i => i.id === 'initiative-alice')).toBe(false);
    const manager2: View = await (await get('manager2')).json();
    const response = await post('manager2', manager2.revision, 'initiative.create', { ownerId: 'alice', title: 'Cross-team assignment', description: 'Must fail.', kpis: [{ name: 'Measure', unit: '%', target: 100 }] });
    expect(response.status).toBe(403);
  });

  it('rejects stale writes with HTTP 409', async () => {
    const manager: View = await (await get('manager')).json();
    const first = await post('manager', manager.revision, 'message.create', { initiativeId: 'initiative-alice', text: 'First concurrent message' });
    expect(first.status).toBe(200);
    const stale = await post('manager', manager.revision, 'message.create', { initiativeId: 'initiative-alice', text: 'Stale concurrent message' });
    expect(stale.status).toBe(409);
  });

  it('rejects unverified and uninvited accounts', async () => {
    await services().auth.createUser({ uid: 'unverified-test', email: 'unverified@example.test', password, emailVerified: false });
    tokens.unverified = await token('unverified@example.test');
    expect((await get('unverified')).status).toBe(403);
    await services().auth.createUser({ uid: 'uninvited-test', email: 'uninvited@example.test', password, emailVerified: true });
    tokens.uninvited = await token('uninvited@example.test');
    expect((await get('uninvited')).status).toBe(403);
  });
});
