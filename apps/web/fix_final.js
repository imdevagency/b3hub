const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

code = code.replace(
`        )}
    </div>
  );
}
// force reload 4`,
`        )
      )}
    </div>
  );
}
// force reload 5`
);

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', code);
