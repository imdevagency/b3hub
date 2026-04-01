/**
 * Dev helper: send a test push notification to a user via the local backend.
 *
 * Usage:
 *   node scripts/send-test-notification.mjs <userId> [title] [message]
 *
 * Requires the backend to be running (npm run dev:backend).
 * The notification appears in-app (DB-stored) and as a push if the user has
 * a pushToken registered. On iOS Simulator push delivery is not supported by
 * APNs, but the in-app notification bell will still update in real time via
 * the WebSocket /updates gateway.
 *
 * Example:
 *   node scripts/send-test-notification.mjs abc123 "New Order" "You have a new order"
 */

const [,, userId, title = 'Test Notification', message = 'This is a local dev test'] = process.argv;

if (!userId) {
  console.error('Usage: node scripts/send-test-notification.mjs <userId> [title] [message]');
  process.exit(1);
}

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Optional: set if endpoint requires auth

const headers = { 'Content-Type': 'application/json' };
if (ADMIN_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_TOKEN}`;

try {
  const res = await fetch(`${API}/notifications/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, title, message }),
  });
  if (res.ok) {
    const data = await res.json();
    console.log('✓ Notification sent:', data);
  } else {
    const text = await res.text();
    console.error(`✗ ${res.status}: ${text}`);
  }
} catch (err) {
  console.error('✗ Could not reach backend at', API, '\n  Is `npm run dev:backend` running?');
  console.error(' ', err.message);
}
