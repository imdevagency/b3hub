import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Visi lauki ir obligāti.' }, { status: 400 });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Nederīga e-pasta adrese.' }, { status: 400 });
    }

    // TODO: wire up Resend / SMTP here
    // e.g. await resend.emails.send({ from: 'noreply@b3hub.lv', to: 'info@b3hub.lv', ... })
    console.log('[contact]', { name, email, message });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Servera kļūda.' }, { status: 500 });
  }
}
