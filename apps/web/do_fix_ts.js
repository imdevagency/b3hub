const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
  `  if (loading) {
    return <PageSpinner className="py-32" />;
  }

  return (`,
  `  if (loading) {
    return <PageSpinner className="py-32" />;
  }

  if (!job) {
    return (
      <EmptyState
        icon={Truck}
        title="Nav aktīva transporta darba"
        description="Jums pašlaik nav neviena aktīva vai uzsākta transporta darba."
      />
    );
  }

  return (`
);

txt = txt.replace(/\{job\.slaStatus && \([\s\S]*?SLA Status.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\}\)/, '');

fs.writeFileSync(file, txt);
console.log('Fixed TS issues');
