const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

const anchor = '{/* Table footer */}';
const parts = content.split(anchor);
if (parts.length === 2) {
  const footerContent = `
            <div className="border-t border-border/40 bg-muted/10 px-6 py-4 text-xs font-semibold text-muted-foreground/70">
              Rāda {filtered.length} no {jobs.length} darb{jobs.length === 1 ? 'a' : 'iem'}
            </div>
          </div>
        )
      )}
    </PageContainer>
  );
}
`;
  fs.writeFileSync('src/app/dashboard/fleet/page.tsx', parts[0] + anchor + footerContent);
} else {
  console.log("Could not find table footer");
}
