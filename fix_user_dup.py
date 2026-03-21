import re
f = 'apps/web/src/lib/api/auth.ts'
content = open(f).read()

duplicate = """  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;\n"""
content = content.replace(duplicate, "", 1)
open(f, 'w').write(content)
