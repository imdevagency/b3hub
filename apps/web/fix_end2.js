const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

code = code.replace(
`            </div>
          ))}
      </div>
    );
}`,
`          </div>
        )
      )}
    </PageContainer>
  );
}`
);

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', code);
