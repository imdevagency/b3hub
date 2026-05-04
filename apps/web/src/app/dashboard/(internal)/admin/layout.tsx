/**
 * Admin section layout.
 *
 * Wraps all pages under /dashboard/admin/* and injects the
 * AdminSectionTabs strip at the top when the current page belongs
 * to a navigation group (Operations, Orders, Finance, People, Catalog, Config).
 *
 * The dashboard root (/dashboard/admin) has no group → no tabs shown.
 */
import { AdminSectionTabs } from '@/components/admin-section-tabs';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSectionTabs />
      {children}
    </>
  );
}
