const fs = require('fs');

let fileContent = fs.readFileSync('src/app/dashboard/catalog/page.tsx', 'utf8');

const replacement = `export default function CatalogPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | null>(null);

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

  const filteredCategories = ALL_CATEGORIES.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const m = CATEGORY_META[c];
    return (
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.defaultName.toLowerCase().includes(q)
    );
  });

  if (activeCategory && token) {
    return (
      <div className="pb-12 max-w-[1400px] mx-auto w-full">
        <WizardInline
          initialCategory={activeCategory}
          token={token}
          onClose={() => setActiveCategory(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-[1400px] mx-auto w-full">
      <PageHeader
        title="Būvmateriāli"
        description="Izvēlieties materiāla kategoriju, lai atrastu labākos piedāvājumus."
        action={
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Meklēt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background w-full"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-8 mt-4">
        {filteredCategories.map((cat) => (
          <CategoryCard
            key={cat}
            category={cat}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
        {filteredCategories.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Nav atrasta neviena kategorija
          </div>
        )}
      </div>
    </div>
  );
}`;

fileContent = fileContent.replace(/export default function CatalogPage\(\) \{[\s\S]*$/, replacement + '\n');
fs.writeFileSync('src/app/dashboard/catalog/page.tsx', fileContent);
