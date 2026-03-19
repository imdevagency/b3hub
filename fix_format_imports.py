"""
Removes local fmtDate / fmtMoney function definitions from dashboard pages
and replaces them with a shared import from @/lib/format.
"""
import re
import os

WEB = "/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard"

PAGES = [
    "buyer/projects/[id]/page.tsx",
    "buyer/projects/page.tsx",
    "orders/[id]/page.tsx",
    "quote-requests/open/page.tsx",
    "quote-requests/page.tsx",
    "schedule/page.tsx",
    "skip-hire/page.tsx",
]

# Matches: optional newline + optional whitespace + function fmtXxx(...) { ... }
FMTDATE_RE = re.compile(
    r'[ \t]*function fmtDate\([^)]*\)[^{]*\{[^\}]+\}\n?',
    re.DOTALL,
)
FMTMONEY_RE = re.compile(
    r'[ \t]*function fmtMoney\([^)]*\)[^{]*\{[^\}]+\}\n?',
    re.DOTALL,
)

for rel in PAGES:
    path = os.path.join(WEB, rel)
    if not os.path.exists(path):
        print(f"SKIP (missing): {path}")
        continue

    with open(path, encoding="utf-8") as f:
        src = f.read()

    orig = src
    has_fmtdate = bool(FMTDATE_RE.search(src))
    has_fmtmoney = bool(FMTMONEY_RE.search(src))

    src = FMTDATE_RE.sub("", src)
    src = FMTMONEY_RE.sub("", src)

    if src == orig:
        print(f"NO MATCH: {rel}")
        continue

    names = []
    if has_fmtdate:
        names.append("fmtDate")
    if has_fmtmoney:
        names.append("fmtMoney")

    # Only add the import if it isn't already there
    if names and "from '@/lib/format'" not in src:
        # Insert after the last contiguous import line block
        lines = src.splitlines(keepends=True)
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith("import "):
                last_import_idx = i
        insert_at = last_import_idx + 1
        new_import = f"import {{ {', '.join(names)} }} from '@/lib/format';\n"
        lines.insert(insert_at, new_import)
        src = "".join(lines)

    # Clean up any double blank lines left behind by the removal
    src = re.sub(r'\n{3,}', '\n\n', src)

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"UPDATED ({', '.join(names)}): {rel}")

print("Done.")
