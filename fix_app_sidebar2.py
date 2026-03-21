f = 'apps/web/src/components/app-sidebar.tsx'
content = open(f).read()
content = content.replace("!!(user as any)?.permManageOrders;", "!!user?.permManageOrders;")
open(f, 'w').write(content)
