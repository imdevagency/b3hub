const fs = require('fs');
const file = 'src/app/dashboard/fleet/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find the position of '</table>'
const index = code.lastIndexOf('</table>');

if (index !== -1) {
    const endStr = code.substring(index);
    // Let's replace everything after </table> entirely, ignoring what it currently is.
    const newEnd = `</table>
            </div> {/* closes overflow-auto */}

            {/* Table footer */}
            <div className="border-t border-border/40 bg-muted/10 px-6 py-4 text-xs font-semibold text-muted-foreground/70">
              Rāda {filtered.length} no {jobs.length} darb{jobs.length === 1 ? "u" : "iem"}
            </div>
          </div>
        )}
    </div>
  );
}
`;
    code = code.substring(0, index) + newEnd;
    fs.writeFileSync(file, code);
    console.log("Replaced end of file");
}
