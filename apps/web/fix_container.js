const fs = require('fs');
let code = fs.readFileSync('src/components/ui/page-container.tsx', 'utf8');

code = code.replace(
  '  containerClassName?: string;\n}',
  '  containerClassName?: string;\n  childrenClassName?: string;\n}'
);

code = code.replace(
  '  containerClassName = \'\',\n  children,\n}: PageContainerProps) {',
  '  containerClassName = \'\',\n  childrenClassName = \'space-y-6\',\n  children,\n}: PageContainerProps) {'
);

code = code.replace(
  '<div className="w-full">\n        {children}\n      </div>',
  '<div className={`w-full ${childrenClassName}`}>\n        {children}\n      </div>'
);

fs.writeFileSync('src/components/ui/page-container.tsx', code);
console.log('Fixed page container spacing');
