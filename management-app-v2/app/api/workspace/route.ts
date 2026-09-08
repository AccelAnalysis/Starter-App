import { NextRequest, NextResponse } from 'next/server';
import { authenticate, flushNotifications, workspace } from '@/lib/server';
import { DomainError, ensure } from '@/lib/policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff'
};

function fail(error: unknown) {
  const known = error instanceof DomainError;
  if (!known) console.error('management_v2_request_failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json(
    { error: known ? error.message : 'The workspace could not save or load. Refresh before retrying.' },
    { status: known ? error.status : 500, headers }
  );
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await workspace(await authenticate(request.headers.get('authorization'))),
      { headers }
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await authenticate(request.headers.get('authorization'));
    ensure(request.headers.get('content-type')?.includes('application/json'), 'Send JSON.', 415);
    ensure(Number(request.headers.get('content-length') || 0) <= 65536, 'Request too large.', 413);
    const raw = await request.text();
    ensure(raw.length <= 65536, 'Request too large.', 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new DomainError('Invalid JSON.');
    }
    ensure(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request.', 400);
    const parsed = body as { revision?: unknown; command?: unknown };
    ensure(parsed.command && typeof parsed.command === 'object' && !Array.isArray(parsed.command), 'Invalid command.', 400);
    const view = await workspace(identity, parsed.command as never, parsed.revision as number);
    await flushNotifications();
    return NextResponse.json(view, { headers });
  } catch (error) {
    return fail(error);
  }
}
