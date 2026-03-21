import re
f = 'apps/web/src/app/dashboard/orders/page.tsx'
content = open(f).read()
content = content.replace("tel:${order.buyer.phone}", "tel:${order.buyer?.phone}")
open(f, 'w').write(content)
