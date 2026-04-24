/**
 * GET /api/company-lookup?regNumber=40003009497
 *
 * Proxy to the Latvijas Uzņēmumu Reģistrs (UR) open data API.
 * Returns company name, legal address, and status for a given registration number.
 * Kept server-side so we never expose any UR API key if one is required in future.
 */
import { NextRequest, NextResponse } from 'next/server';

// UR open data endpoint — free, no auth required for basic lookups
const UR_API_BASE = 'https://dati.ur.gov.lv/api/v1/organizations';

export async function GET(req: NextRequest) {
  const regNumber = req.nextUrl.searchParams.get('regNumber')?.trim();

  if (!regNumber) {
    return NextResponse.json({ error: 'regNumber is required' }, { status: 400 });
  }

  // Sanitise — UR reg numbers are 11-digit strings starting with 4 (LV companies)
  // or 2 (individual merchants). Allow only digits.
  if (!/^\d{8,12}$/.test(regNumber)) {
    return NextResponse.json({ error: 'Invalid registration number format' }, { status: 400 });
  }

  try {
    const url = `${UR_API_BASE}?registration_number=${encodeURIComponent(regNumber)}&_format=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // 5s timeout — user is waiting in a form
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'UR service unavailable' }, { status: 502 });
    }

    const data = await res.json();

    // UR returns an array; pick the first match
    const org = Array.isArray(data) ? data[0] : data?.data?.[0] ?? null;

    if (!org) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      name: org.name ?? org.organization_name ?? null,
      status: org.status ?? null,
      address: org.legal_address ?? org.address ?? null,
    });
  } catch (err) {
    // AbortError = timeout; other = network issue
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      { error: isTimeout ? 'UR lookup timed out' : 'Lookup failed' },
      { status: 502 },
    );
  }
}
