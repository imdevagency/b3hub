'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'Kļūda');
      }

      setStatus('sent');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Servera kļūda. Mēģiniet vēlāk.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border border-border p-10 flex flex-col gap-4">
        <p className="text-lg font-medium tracking-tight">Paldies!</p>
        <p className="text-muted-foreground font-light text-sm">
          Jūsu ziņojums nosūtīts. Atbildēsim 1 darba dienas laikā.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border border-border p-10 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          Vārds, uzvārds
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={status === 'sending'}
          placeholder="Jānis Bērziņš"
          className="border border-border bg-background text-foreground px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          E-pasts
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={status === 'sending'}
          placeholder="janis@piemers.lv"
          className="border border-border bg-background text-foreground px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-medium">
          Ziņojums
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          disabled={status === 'sending'}
          placeholder="Kā varam palīdzēt?"
          className="border border-border bg-background text-foreground px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none disabled:opacity-50"
        />
      </div>

      {status === 'error' && <p className="text-sm text-red-500">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-foreground text-background px-10 py-5 text-lg font-semibold tracking-tight hover:bg-foreground/90 transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Sūta…' : 'Nosūtīt ziņojumu'}
      </button>
    </form>
  );
}
