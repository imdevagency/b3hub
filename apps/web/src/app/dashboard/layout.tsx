/**
 * Dashboard shell layout.
 * Renders the app sidebar, top navigation, and wraps all dashboard routes.
 * Guarded by DashboardGuard — redirects to /login if unauthenticated.
 */
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarSwitch } from '@/components/sidebar-switch';
import { ModeProvider } from '@/lib/mode-context';
import { DashboardGuard } from '@/components/dashboard-guard';
import { NotificationBell } from '@/components/notification-bell';
import { PageAnimate } from '@/components/ui/page-animate';
import { DashboardBreadcrumb } from '@/components/dashboard-breadcrumb';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <DashboardGuard>
        <SidebarProvider>
          <SidebarSwitch />
          <SidebarInset className="bg-white">
            {/* Top chrome */}
            <header className="flex h-14 shrink-0 items-center justify-between px-6 xl:px-8 bg-white border-b border-gray-200">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full" />
                <span className="text-sm font-semibold tracking-tight text-gray-800 md:hidden block">
                  B3Hub
                </span>
                <DashboardBreadcrumb />
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-100 hover:bg-gray-200 transition-colors p-1">
                  <NotificationBell />
                </div>
              </div>
            </header>

            {/* Page content */}
            <div className="relative flex flex-1 flex-col gap-6 p-6 xl:p-8 min-h-[calc(100vh-4rem)] max-w-screen-2xl w-full mx-auto">
              <PageAnimate>{children}</PageAnimate>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DashboardGuard>
    </ModeProvider>
  );
}
