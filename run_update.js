const fs = require('fs');

const path = 'apps/mobile/app/(buyer)/catalog.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add Check icon import and BottomSheet
code = code.replace(
  /Search,\n  X,\n  PackageSearch,/,
  "Search,\n  X,\n  Check,\n  PackageSearch,"
);
code = code.replace(
  /import \{ SkeletonCard \} from '@\/components\/ui\/Skeleton';/,
  "import { SkeletonCard } from '@/components/ui/Skeleton';\nimport { BottomSheet } from '@/components/ui/BottomSheet';"
);

// 2. Remove CategoryPill
code = code.replace(/\/\/ ── Category Pill ──[\s\S]*?\/\/ ── Product Card ─*\n/, '// ── Product Card ────────────────────────────────────────────────\n');

// 3. Update ProductCard UI
const newProductCard = `
function ProductCard({ material, onPress }: { material: ApiMaterial; onPress: () => void }) {
  const meta = CATEGORY_META[material.category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;
  const imageH = Math.round(CARD_W * 0.85);

  return (
    <TouchableOpacity
      style={[s.productCard, { width: CARD_W }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Photo / illustration area */}
      <View style={[s.productImg, { height: imageH, backgroundColor: meta.bg }]}>
        <Icon size={48} color={meta.accent} strokeWidth={1} />
        {material.isRecycled && (
          <View style={s.ecoBadge}>
            <Leaf size={12} color="#16a34a" strokeWidth={2.5} />
          </View>
        )}
      </View>

      {/* Name & Info */}
      <View style={s.productBody}>
        <Text style={s.productName} numberOfLines={2}>
          {material.name}
        </Text>
        {material.supplier?.name ? (
          <Text style={s.productSupplier} numberOfLines={1}>
            {material.supplier.name}
          </Text>
        ) : null}
        
        <View style={s.priceBox}>
          <Text style={s.priceAmount}>
            {'ex \u20ac' + material.basePrice.toFixed(2)}
            <Text style={s.priceUnit}>{' / ' + UNIT_SHORT[material.unit]}</Text>
          </Text>
          <Text style={s.priceSub}>{'Franco b\u016bvlaukums'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
`;
code = code.replace(/function ProductCard\([\s\S]*?\n\}\n/, newProductCard.trim() + '\n');


// 4. Update Screen Component
// Add state
code = code.replace(
  /const \[category, setCategory\] = useState.*?;\n/,
  "const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');\n  const [filterOpen, setFilterOpen] = useState(false);\n"
);

// Search & Filter layout
const oldSearchFilter = /\{\/\* ── Search bar ──[\s\S]*?\{\/\* ── Product grid ──/;
const newSearchFilter = `{/* ── Search & Filters ───────────────────────────────── */}
      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Search size={18} color="#6b7280" strokeWidth={2.5} />
            <TextInput
              style={s.searchInput}
              placeholder={'Mekl\u0113t materi\u0101lus...'}
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={onSearchChange}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  loadMaterials('', category, true);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={s.clearBtn}
              >
                <X size={12} color="#fff" strokeWidth={3} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[s.filterBtn, category !== 'ALL' && s.filterBtnActive]} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
            <SlidersHorizontal size={20} color={category !== 'ALL' ? '#fff' : '#111827'} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {category !== 'ALL' && (
          <View style={s.activeFilterRow}>
            <TouchableOpacity style={s.activeFilterChip} onPress={() => selectCategory('ALL')} activeOpacity={0.7}>
              <Text style={s.activeFilterText}>{CATEGORY_LABELS[category]}</Text>
              <View style={s.activeFilterClear}>
                <X size={14} color="#111827" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Product grid ──`;

code = code.replace(oldSearchFilter, newSearchFilter);

// 5. Add BottomSheet before closing ScreenContainer
const sheetCode = `
      {/* ── Filter Modal ───────────────────────────────────── */}
      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtr\u0113t materi\u0101lus"
        scrollable={true}
      >
        <View style={s.filterContent}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.filterOption, isSelected && s.filterOptionSelected]}
                activeOpacity={0.7}
                onPress={() => {
                  selectCategory(cat);
                  setFilterOpen(false);
                }}
              >
                <View style={s.filterOptionLeft}>
                  <View style={[s.filterOptionIcon, { backgroundColor: meta.bg }]}>
                    <Icon size={20} color={meta.accent} strokeWidth={1.5} />
                  </View>
                  <Text style={[s.filterOptionLabel, isSelected && s.filterOptionLabelSelected]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </View>
                {isSelected && <Check size={20} color="#111827" strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </ScreenContainer>
`;
code = code.replace(/<\/ScreenContainer>\n\s*\);\n\}/, sheetCode.trim() + '\n  );\n}\n');

// 6. Styles update (search, cards, filter)
const oldStylesRegex = /searchWrap: \{[\s\S]*?productSupplier: \{[\s\S]*?\},/m;

const newStyles = `searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#111827', 
    padding: 0,
    fontWeight: '500',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  activeFilterRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  activeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activeFilterClear: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 16,
    flexGrow: 1,
  },
  gridRow: {
    gap: 16,
    justifyContent: 'flex-start',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },

  productCard: {
    backgroundColor: 'transparent',
  },
  productImg: {
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  ecoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    padding: 6,
  },
  productBody: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  productSupplier: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 6,
  },
  priceBox: {
    marginTop: 'auto',
    alignItems: 'flex-start',
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  priceUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  priceSub: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },

  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 4,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterOptionSelected: {
    // optional selected style
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  filterOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  filterOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  filterOptionLabelSelected: {
    color: '#111827',
    fontWeight: '700',
  },`;

code = code.replace(oldStylesRegex, newStyles);

fs.writeFileSync(path, code);
console.log('Update Complete!');
