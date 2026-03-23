const fs = require('fs');
const file = 'src/app/dashboard/fleet/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const lastLines = `            {/* Table footer */}
            <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              {filtered.length} no {jobs.length} darb{jobs.length === 1 ? 'a' : 'iem'}
            </div>
          </div>
        ))}
    </div>
  );
}`;

const replaceWith = `            {/* Table footer */}
            <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              {filtered.length} no {jobs.length} darb{jobs.length === 1 ? 'a' : 'iem'}
            </div>
            </div>
          </div>
        )}
    </div>
  );
}`;

code = code.replace(lastLines, replaceWith);
fs.writeFileSync(file, code);
