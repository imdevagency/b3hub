f = 'apps/web/src/lib/api/auth.ts'
content = open(f).read()
import re

# remove whatever mess is there between emailVerified and availableModes
content = re.sub(r'emailVerified: boolean;.*availableModes: Mode\[\];', 'emailVerified: boolean;\n  companyRole?: CompanyRole;\n  permCreateContracts?: boolean;\n  permReleaseCallOffs?: boolean;\n  permManageOrders?: boolean;\n  permViewFinancials?: boolean;\n  permManageTeam?: boolean;\n  availableModes: Mode[];', content, flags=re.DOTALL)

open(f, 'w').write(content)
