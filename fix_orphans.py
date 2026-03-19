"""
Fix orphaned ); and } left by partial fmtDate removal from the broken heredoc script.
The pattern to remove is:   \n);\n}\n  (standalone lines, empty context)
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

# The orphaned tail: lines that are exactly ");" then "}" (possibly with blank lines around them)
ORPHAN_RE = re.compile(r'\n\s*\);\n\s*\}\n', re.MULTILINE)

for rel in PAGES:
    path = os.path.join(WEB, rel)
    if not os.path.exists(path):
        print(f"SKIP: {rel}")
        continue

    with open(path, encoding="utf-8") as f:
        src = f.read()

    orig = src
    # Remove the orphaned ); } 
    src = ORPHAN_RE.sub('\n', src)

    # Clean up excessive blank lines
    src = re.sub(r'\n{3,}', '\n\n', src)

    if src == orig:
        print(f"NO CHANGE: {rel}")
    else:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
        print(f"FIXED: {rel}")

print("Done.")
