/**
 * apps/web root page.
 *
 * This is the authenticated portal (app.b3hub.lv / localhost:3001).
 * Marketing lives at apps/landing (b3hub.lv / localhost:3002) — a separate app.
 *
 * Unauthenticated users who land here get sent to /login.
 * After login the auth flow redirects to /dashboard.
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
