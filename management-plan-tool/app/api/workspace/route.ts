import { NextRequest, NextResponse } from 'next/server';
import { authenticate, workspace } from '@/lib/server';
import { DomainError, ensure } from '@/lib/policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
function fail(error: unknown) { const known = error instanceof DomainError; if (!known) console.error('workspace_request_failed', error instanceof Error ? error.name : 'unknown'); return NextResponse.json({ error: known ? error.message : 'The workspace could not save or load. No successful save has been confirmed; refresh before retrying.' }, { status: known ? error.status : 500, headers }); }
export async function GET(request: NextRequest) { try { return NextResponse.json(await workspace(await authenticate(request.headers.get('authorization'))), { headers }); } catch (error) { return fail(error); } }
export async function POST(request: NextRequest) { try { const identity = await authenticate(request.headers.get('authorization')); ensure(request.headers.get('content-type')?.includes('application/json'), 'Send JSON.', 415); ensure(Number(request.headers.get('content-length') || 0) <= 32768, 'Request too large.', 413); const raw = await request.text(); ensure(raw.length <= 32768, 'Request too large.', 413); let body; try { body = JSON.parse(raw); } catch { throw new DomainError('Invalid JSON.'); } ensure(body && typeof body === 'object' && !Array.isArray(body) && body.command && typeof body.command === 'object', 'Invalid command.', 400); return NextResponse.json(await workspace(identity, body.command, body.revision), { headers }); } catch (error) { return fail(error); } }
