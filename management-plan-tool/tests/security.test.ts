import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/workspace/route';
import { services, workspace } from '../lib/server';
import { fixture } from './fixture';
import { emulatorEnvironment, seed, token, password } from './emulator';
import type { View } from '../lib/model';
emulatorEnvironment();
let environment: RulesTestEnvironment;
const tokens: Record<string, string> = {};
async function get(who: string) { return GET(new NextRequest('http://localhost/api/workspace', { headers: { authorization: `Bearer ${tokens[who]}` } })); }
async function post(who: string, revision: number, type: string, payload: Record<string, unknown>) { return POST(new NextRequest('http://localhost/api/workspace', { method: 'POST', headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' }, body: JSON.stringify({ revision, command: { type, payload } }) })); }
beforeAll(async () => { await seed(fixture()); environment = await initializeTestEnvironment({ projectId: 'demo-management', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); for (const who of ['admin', 'manager', 'alice', 'bob', 'outsider']) tokens[who] = await token(`${who}@example.test`); });
afterAll(async () => { await environment?.cleanup(); });
describe('Browser clients cannot bypass the authenticated API', () => {
  it('denies guest reads and writes', async () => { const db = environment.unauthenticatedContext().firestore(); await assertFails(getDoc(doc(db, 'managementWorkspaces/management'))); await assertFails(setDoc(doc(db, 'managementWorkspaces/injected'), { admin: true })); });
  it('denies direct reads even for an authenticated administrator', async () => { const db = environment.authenticatedContext('admin-uid', { email: 'admin@example.test', email_verified: true }).firestore(); await assertFails(getDoc(doc(db, 'managementWorkspaces/management'))); await assertFails(setDoc(doc(db, 'managementWorkspaces/management/records/member'), { role: 'admin' })); });
  it('denies legacy per-user paths rather than leaving starter permissions open', async () => { const db = environment.authenticatedContext('alice-uid').firestore(); await assertFails(setDoc(doc(db, 'users/alice-uid/records/test'), { title: 'Bypass' })); });
});
describe('The API verifies identity and management authority', () => {
  it('rejects unauthenticated and forged sessions', async () => { expect((await GET(new NextRequest('http://localhost/api/workspace'))).status).toBe(401); const response = await GET(new NextRequest('http://localhost/api/workspace', { headers: { authorization: 'Bearer forged.not-a-token.signature' } })); expect(response.status).toBe(401); });
  it('serves only Alice’s authorized view and never caches private data', async () => { const response = await get('alice'); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store'); const v: View = await response.json(); expect(v.me.email).toBe('alice@example.test'); expect(v.plans).toHaveLength(1); expect(JSON.stringify(v)).not.toContain('Private Bob expectations'); expect(v.audit).toEqual([]); expect(v.members).toHaveLength(1); });
  it('rejects employee privilege escalation through a handcrafted request', async () => { const v: View = await (await get('alice')).json(); const response = await post('alice', v.revision, 'member.save', { email: 'alice@example.test', name: 'Alice', role: 'admin' }); expect(response.status).toBe(403); expect((await (await get('alice')).json()).me.role).toBe('employee'); });
  it('rejects out-of-scope manager mutations', async () => { const admin: View = await (await get('admin')).json(); const alice = admin.members.find(m => m.email === 'alice@example.test')!; const p = admin.plans.find(p => p.ownerId === alice.id)!; const response = await post('outsider', admin.revision, 'expectation.save', { planId: p.id, ownerId: alice.id, kind: 'goal', title: 'Unauthorized', target: '10', measure: 'Count', frequency: 'Weekly' }); expect(response.status).toBe(403); });
  it('rejects unverified and uninvited accounts', async () => { await services().auth.createUser({ uid: 'unverified-test', email: 'unverified@example.test', password, emailVerified: false }); tokens.unverified = await token('unverified@example.test'); expect((await get('unverified')).status).toBe(403); await services().auth.createUser({ uid: 'uninvited-test', email: 'uninvited@example.test', password, emailVerified: true }); tokens.uninvited = await token('uninvited@example.test'); expect((await get('uninvited')).status).toBe(403); });
  it('rejects a disabled Firebase account even if its old token exists', async () => { await services().auth.updateUser('bob-uid', { disabled: true }); expect((await get('bob')).status).toBe(401); await services().auth.updateUser('bob-uid', { disabled: false }); tokens.bob = await token('bob@example.test'); });
  it('persists the complete feedback-follow-up-evidence loop through the API', async () => {
    let alice: View = await (await get('alice')).json(); const p = alice.plans[0];
    const admin: View = await (await get('admin')).json(); const manager = admin.members.find(m => m.email === 'manager@example.test')!;
    let response = await post('alice', alice.revision, 'feedback.create', { planId: p.id, recipientId: manager.id, category: 'Support Needed', visibility: 'private', responseRequired: true, responseDue: '2026-09-14', text: 'API PRIVATE ALICE BLOCKER' }); expect(response.status).toBe(200); alice = await response.json(); const f = alice.feedback.find(f => f.text === 'API PRIVATE ALICE BLOCKER')!;
    const bob: View = await (await get('bob')).json(); expect(JSON.stringify(bob)).not.toContain('API PRIVATE ALICE BLOCKER');
    response = await post('manager', alice.revision, 'followup.create', { planId: p.id, ownerId: alice.me.id, sourceType: 'feedback', sourceId: f.id, description: 'Resolve the API blocker', dueDate: '2026-09-14' }); expect(response.status).toBe(200); let updated: View = await response.json(); const action = updated.actions.find(a => a.sourceId === f.id)!;
    response = await post('alice', updated.revision, 'action.verify', { id: action.id }); expect(response.status).toBe(403);
    response = await post('alice', updated.revision, 'action.progress', { id: action.id, status: 'submitted', evidence: 'Verified reference API-001' }); expect(response.status).toBe(200); updated = await response.json();
    response = await post('manager', updated.revision, 'feedback.respond', { id: f.id, status: 'resolved', response: 'Premature closure' }); expect(response.status).toBe(409);
    response = await post('manager', updated.revision, 'action.verify', { id: action.id }); expect(response.status).toBe(200); updated = await response.json();
    response = await post('manager', updated.revision, 'feedback.respond', { id: f.id, status: 'resolved', response: 'Evidence reviewed and approved.' }); expect(response.status).toBe(200);
    alice = await (await get('alice')).json(); expect(alice.feedback.find(x => x.id === f.id)?.status).toBe('resolved'); expect(alice.actions.find(x => x.id === action.id)?.evidence).toBe('Verified reference API-001'); expect(alice.followUps.find(x => x.actionId === action.id)?.status).toBe('completed');
  });
  it('allows only one concurrent command against the same revision', async () => { const v: View = await (await get('admin')).json(); const responses = await Promise.all([post('admin', v.revision, 'team.create', { name: 'Concurrent A' }), post('admin', v.revision, 'team.create', { name: 'Concurrent B' })]); expect(responses.map(r => r.status).sort()).toEqual([200, 409]); const updated: View = await (await get('admin')).json(); expect(updated.teams.filter(t => t.name.startsWith('Concurrent'))).toHaveLength(1); });
  it('refuses unknown commands and oversized inputs', async () => { const v: View = await (await get('admin')).json(); expect((await post('admin', v.revision, 'unknown.delete.everything', {})).status).toBe(400); expect((await post('admin', v.revision, 'team.create', { name: 'X'.repeat(40000) })).status).toBe(413); });
  it('rechecks disabled membership on every request', async () => { const v: View = await (await get('admin')).json(); const bob = v.members.find(m => m.email === 'bob@example.test')!; expect((await post('admin', v.revision, 'member.save', { ...bob, active: false })).status).toBe(200); expect((await get('bob')).status).toBe(403); });
  it('refuses duplicate identity claims of an already bound verified email', async () => { await expect(workspace({ uid: 'a-different-uid', email: 'alice@example.test', name: 'Impostor' })).rejects.toThrow('not been invited'); });
});
