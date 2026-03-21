f = 'apps/web/src/lib/api/auth.ts'
content = open(f).read()

to_add = """  companyRole?: CompanyRole;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;"""

content = content.replace("  companyRole?: CompanyRole;", to_add)
open(f, 'w').write(content)
