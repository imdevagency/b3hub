import re
f = 'apps/web/src/lib/api/auth.ts'
content = open(f).read()

# remove all permissions lines
content = re.sub(r'\s*permCreateContracts\?: boolean;\n', '', content)
content = re.sub(r'\s*permReleaseCallOffs\?: boolean;\n', '', content)
content = re.sub(r'\s*permManageOrders\?: boolean;\n', '', content)
content = re.sub(r'\s*permViewFinancials\?: boolean;\n', '', content)
content = re.sub(r'\s*permManageTeam\?: boolean;\n', '', content)

# insert them once after companyRole
to_add = """  companyRole?: CompanyRole;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;\n"""
content = re.sub(r'\s*companyRole\?: CompanyRole;\n', '\n' + to_add, content)

open(f, 'w').write(content)
