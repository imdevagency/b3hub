import re
f = 'apps/web/src/components/app-sidebar.tsx'
content = open(f).read()
content = content.replace("!!user?.permManageOrders;", "!!(user as any)?.permManageOrders;")
open(f, 'w').write(content)
