/**
 * Session cookie route.
 * Sets / clears a HttpOnly cookie so the JWT never touches JavaScript.
 * The middleware reads this cookie server-side for route protection.
 */
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'b3hub_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).token !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const token = (body as Record<string, string>).token;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
