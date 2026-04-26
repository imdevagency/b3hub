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
      <div className="bg-background rounded-[2rem] p-10 md:p-14 flex flex-col gap-4 text-center items-center justify-center min-h-100 shadow-sm">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-2xl font-medium tracking-tight">Paldies!</p>
        <p className="text-muted-foreground font-light text-base max-w-70">
          Jūsu ziņojums nosūtīts. Atbildēsim 1 darba dienas laikā.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-background rounded-[2rem] p-8 md:p-12 flex flex-col gap-6 shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-base font-medium px-1">
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
          className="border-none bg-neutral-50 rounded-2xl text-foreground px-5 py-4 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground transition-all disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-base font-medium px-1">
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
          className="border-none bg-neutral-50 rounded-2xl text-foreground px-5 py-4 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground transition-all disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-base font-medium px-1">
          Ziņojums
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          disabled={status === 'sending'}
          placeholder="Kā varam palīdzēt?"
          className="border-none bg-neutral-50 rounded-2xl text-foreground px-5 py-4 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground transition-all resize-none disabled:opacity-50"
        />
      </div>

      {status === 'error' && <p className="text-base text-red-500 px-1">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-2 w-full bg-foreground text-background rounded-full px-10 py-5 text-lg font-medium tracking-tight hover:bg-foreground/90 transition-all disabled:opacity-50"
      >
        {status === 'sending' ? 'Sūta…' : 'Nosūtīt ziņojumu'}
      </button>
    </form>
  );
}
