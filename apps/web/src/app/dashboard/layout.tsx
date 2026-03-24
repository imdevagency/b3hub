/**
 * Dashboard shell layout.
 * Renders the app sidebar, top navigation, and wraps all dashboard routes.
 * Guarded by DashboardGuard — redirects to /login if unauthenticated.
 */
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ModeProvider } from '@/lib/mode-context';
import { DashboardGuard } from '@/components/dashboard-guard';
import { NotificationBell } from '@/components/notification-bell';
import { PageAnimate } from '@/components/ui/page-animate';
import { RoleModeSwitcher } from '@/components/role-mode-switcher';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <DashboardGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-muted/10">
            {/* Top chrome */}
            <header className="flex h-14 shrink-0 items-center justify-between px-6 xl:px-8 mt-2">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full" />
                <span className="text-sm font-semibold tracking-tight text-foreground/80 md:hidden block">
                  B3Hub
                </span>
              </div>
              <div className="flex items-center gap-3">
                <RoleModeSwitcher />
                <div className="rounded-full bg-background/50 hover:bg-muted/50 transition-colors p-1">
                  <NotificationBell />
                </div>
              </div>
            </header>

            {/* Page content */}
            <div className="relative flex flex-1 flex-col gap-6 p-6 xl:p-8 min-h-[calc(100vh-4rem)]">
              <PageAnimate>{children}</PageAnimate>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DashboardGuard>
    </ModeProvider>
  );
}
