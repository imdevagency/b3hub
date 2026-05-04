/**
 * Portal section layout.
 *
 * Wraps all pages under /dashboard/(platform)/* and injects the
 * PortalSectionTabs strip at the top when the current page belongs
 * to a navigation group.
 *
 * Role home pages (buyer, supplier, transporter, construction, recycling)
 * have no group → no tabs shown.
 */
import { PortalSectionTabs } from '@/components/portal-section-tabs';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortalSectionTabs />
      {children}
    </>
  );
}
