/**
 * Dashboard shell layout.
 * Renders the app sidebar, top navigation, and wraps all dashboard routes.
 * Guarded by DashboardGuard — redirects to /login if unauthenticated.
 */
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { CartProvider } from '@/lib/cart-context';
import { ModeProvider } from '@/lib/mode-context';
import { DashboardGuard } from '@/components/dashboard-guard';
import { NotificationBell } from '@/components/notification-bell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ModeProvider>
        <DashboardGuard>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Top chrome */}
              <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <span className="text-sm font-medium text-muted-foreground">Dashboard</span>
                <div className="ml-auto">
                  <NotificationBell />
                </div>
              </header>

              {/* Page content */}
              <div className="flex flex-1 flex-col gap-6 p-6 bg-muted/20 min-h-[calc(100vh-3.5rem)]">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </DashboardGuard>
      </ModeProvider>
    </CartProvider>
  );
}
