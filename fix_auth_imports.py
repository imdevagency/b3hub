"""
Replaces the repeated auth-redirect useEffect boilerplate with useRequireAuth().

Pattern A (redirects to '/'):
  const { token, isLoading } = useAuth();
  const router = useRouter();
  ...
  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

Pattern B (redirects to '/login', uses user):
  const { user, token, isLoading } = useAuth();  (various destructuring combos)
  const router = useRouter();
  ...
  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [...]);
"""
import re
import os

WEB = "/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard"


def _replace_useauth(fields: str, redirect: str) -> str:
    """
    Replace const { token, isLoading, user, ... } = useAuth()
    with const { token, user, ... } = useRequireAuth(redirectTo)
    (isLoading is removed since the hook handles it internally).
    """
    parts = [p.strip() for p in fields.split(",") if p.strip() and p.strip() != "isLoading"]
    # Only pass redirect arg when it's not the default '/'
    suffix = f"('{redirect}')" if redirect != "/" else "()"
    if not parts:
        return f"const auth = useRequireAuth{suffix};"
    return f"const {{ {', '.join(parts)} }} = useRequireAuth{suffix};"


PAGES = [
    # (relative path, redirect target)
    ("buyer/page.tsx", "/login"),
    ("catalog/page.tsx", "/"),
    ("checkout/page.tsx", "/"),
    ("documents/page.tsx", "/login"),
    ("fleet/page.tsx", "/login"),
    ("garage/page.tsx", "/login"),
    ("jobs/page.tsx", "/login"),
    ("materials/page.tsx", "/"),
    ("skip-hire/page.tsx", "/login"),
    ("supplier/page.tsx", "/login"),
    ("transporter/page.tsx", "/login"),
    ("buyer/projects/[id]/page.tsx", "/login"),
    ("buyer/projects/page.tsx", "/login"),
    ("orders/[id]/page.tsx", "/"),
    ("quote-requests/open/page.tsx", "/"),
    ("quote-requests/page.tsx", "/"),
    ("recycling-centers/page.tsx", "/"),
    ("reviews/page.tsx", "/"),
    ("settings/page.tsx", "/"),
    ("company/page.tsx", "/"),
    ("company/team/page.tsx", "/"),
    ("garage/page.tsx", "/login"),
    ("supplier/earnings/page.tsx", "/login"),
    ("transporter/earnings/page.tsx", "/login"),
    ("admin/page.tsx", "/"),
    ("admin/users/page.tsx", "/"),
    ("admin/applications/page.tsx", "/"),
]

# The auth useEffect block (various forms)
AUTH_EFFECT_RE = re.compile(
    r'[ \t]*useEffect\(\(\) => \{\s*'
    r'if \(!isLoading && !\w+\) router\.push\([\'"][^\'"]+[\'"]\);\s*'
    r'\}, \[[^\]]*\]\);\n?',
    re.DOTALL,
)

# Standalone: if (!token) router.push('/');  (used in OrdersPage component)
SIMPLE_AUTH_RE = re.compile(
    r'[ \t]*useEffect\(\(\) => \{\s*'
    r'if \(!\w+\) router\.push\([\'"][^\'"]+[\'"]\);\s*'
    r'\}, \[[^\]]*\]\);\n?',
    re.DOTALL,
)

for rel, redirect in PAGES:
    path = os.path.join(WEB, rel)
    if not os.path.exists(path):
        print(f"SKIP (missing): {rel}")
        continue

    with open(path, encoding="utf-8") as f:
        src = f.read()

    orig = src

    # Skip if already updated
    if "useRequireAuth" in src:
        print(f"ALREADY DONE: {rel}")
        continue

    # Check if there's an auth useEffect to remove
    has_auth_effect = bool(AUTH_EFFECT_RE.search(src) or SIMPLE_AUTH_RE.search(src))
    if not has_auth_effect:
        print(f"NO AUTH EFFECT: {rel}")
        continue

    # Remove the auth redirect useEffect
    src = AUTH_EFFECT_RE.sub("", src)
    src = SIMPLE_AUTH_RE.sub("", src)

    # Replace `useAuth` import line → add useRequireAuth import
    src = re.sub(
        r"import \{ useAuth \} from '@/lib/auth-context';\n",
        f"import {{ useRequireAuth }} from '@/hooks/use-require-auth';\n",
        src,
    )
    # Handle multi-destructure: import { useAuth, ... } from '@/lib/auth-context'
    src = re.sub(
        r"import \{ useAuth, ([^}]+)\} from '@/lib/auth-context';\n",
        lambda m: (
            f"import {{ useRequireAuth }} from '@/hooks/use-require-auth';\n"
            f"import {{ {m.group(1).strip()} }} from '@/lib/auth-context';\n"
        ),
        src,
    )
    src = re.sub(
        r"import \{ ([^}]+), useAuth \} from '@/lib/auth-context';\n",
        lambda m: (
            f"import {{ useRequireAuth }} from '@/hooks/use-require-auth';\n"
            f"import {{ {m.group(1).strip()} }} from '@/lib/auth-context';\n"
        ),
        src,
    )

    # Remove `import { useRouter } from 'next/navigation'` IF it's no longer needed
    # (only remove if router.push is only used for auth — we check if any other push exists)
    # We'll keep it for safety and only remove standalone useRouter imports if no other usage
    # Count remaining router.push calls (after removing auth effect)
    router_push_count = src.count("router.push(")
    if router_push_count == 0:
        src = re.sub(r"import \{ useRouter \} from 'next/navigation';\n", "", src)
        # Remove: const router = useRouter();
        src = re.sub(r"[ \t]*const router = useRouter\(\);\n", "", src)

    # Replace const { token/user/isLoading, ... } = useAuth(); → useRequireAuth
    # Handle various destructuring patterns
    src = re.sub(
        r"const \{ ([^}]+)\} = useAuth\(\);",
        lambda m: _replace_useauth(m.group(1).strip(), redirect),
        src,
    )

    # Clean up double blank lines
    src = re.sub(r'\n{3,}', '\n\n', src)

    if src == orig:
        print(f"NO CHANGE: {rel}")
        continue

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"UPDATED: {rel}")

print("Done.")
