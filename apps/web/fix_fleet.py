import re

with open('src/app/dashboard/fleet/page.tsx', 'r') as f:
    text = f.read()

# Let's fix the end structure completely. Let's find from </table> downwards.
text = re.sub(r'</table>[\s\S]*?(?=\}\s*\)\}\n\s*</div>\n\s*\);\n\})', 
'''</table>
            </div> {/* closes overflow-auto */}

            {/* Table footer */}
            <div className="border-t border-border/40 bg-muted/10 px-6 py-4 text-xs font-semibold text-muted-foreground/70">
              Rāda {filtered.length} no {jobs.length} darb{jobs.length === 1 ? "u" : "iem"}
            </div>
          </div>
        ''', text)

with open('src/app/dashboard/fleet/page.tsx', 'w') as f:
    f.write(text)
