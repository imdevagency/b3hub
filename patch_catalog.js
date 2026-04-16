const fs = require('fs');
let code = fs.readFileSync('apps/mobile/app/(buyer)/catalog.tsx', 'utf-8');

// The file is pretty large but only because of styles. Let's see the length.
// We can actually just replace CategoryCard entirely.
const catCardStart = code.indexOf('function CategoryCard({');
const catCardEnd = code.indexOf('export default function CatalogScreen()');

const newCatCard = `function CategoryCard({
  category,
  hasRecycled,
  supplierCount,
  minPrice,
  onPress,
}: {
  category: MaterialCategory;
  hasRecycled: boolean;
  supplierCount: number;
  minPrice: number | null;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[category] ?? { bg: '#f3f4f6', accent: '#6b7280', icon: Package };
  const Icon = meta.icon;
  const description = CATEGORY_DESCRIPTIONS[category];

  return (
    <TouchableOpacity
      className="bg-white mx-5 mb-4 rounded-3xl p-5 shadow-sm border border-gray-100 flex-row items-center"
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.8}
    >
      <View className="bg-gray-50 h-14 w-14 rounded-2xl items-center justify-center mr-4">
        <Icon size={24} color="#111827" strokeWidth={1.5} />
      </View>

      <View className="flex-1 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-gray-900 font-extrabold tracking-tight text-lg line-clamp-1">{CATEGORY_LABELS[category]}</Text>
        </View>
        <Text className="text-gray-500 font-medium text-sm line-clamp-1">
          {supplierCount > 0 ? \`\${supplierCount} piegādātāji\` : description}
        </Text>
      </View>
      
      <View className="items-end justify-center ml-2">
        {minPrice != null && (
          <Text className="text-gray-900 font-bold text-sm tracking-tight bg-gray-50 px-3 py-1.5 rounded-xl">
             no €{minPrice.toFixed(2)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

`;
code = code.slice(0, catCardStart) + newCatCard + code.slice(catCardEnd);

// Now for the render function of CatalogScreen. We search for "return (" in CatalogScreen.
// Because it's the last function in the file, we can find the first "return (" that doesn't belong to a callback.
// OR we can just regex the render block out and replace it. Let's just find the render and replace it, AND nuke StyleSheet.
const renderStartRegex = /  return \([\s\S]*?(?=const s = StyleSheet\.create)/;
const match = code.match(renderStartRegex);

if (match) {
  const newRender = `  return (
    <ScreenContainer bg="#f9fafb">
      <View className="px-5 pt-8 pb-2">
        <Text className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Katalogs
        </Text>
        <Text className="text-gray-500 text-sm font-medium mt-1">
          Atrodiet labākos piegādātājus
        </Text>
      </View>

      {/* ── Search ── */}
      <View className="px-5 py-3 mb-2">
        <View className={\`flex-row items-center bg-white rounded-2xl px-4 py-3 \${searchFocused ? 'border-amber-600 border-2' : 'border-gray-200 border shadow-sm'}\`}>
          <Search size={18} color={searchFocused ? '#b45309' : '#9ca3af'} className="mr-3" />
          <TextInput
            className="flex-1 font-medium text-base text-gray-900 pt-0 pb-0"
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { haptics.light(); setQuery(''); }} className="ml-2 bg-gray-100 p-1.5 rounded-full">
              <X size={14} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter chips ── */}
      <View className="mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            className={\`px-5 py-2.5 rounded-2xl flex-row items-center \${filterMode === 'ALL' ? 'bg-gray-900 shadow-sm' : 'bg-white border-gray-100 border'}\`}
            onPress={() => { haptics.light(); setFilterMode('ALL'); }}
            activeOpacity={0.8}
          >
            <Text className={\`font-bold \${filterMode === 'ALL' ? 'text-white' : 'text-gray-600'}\`}>
              Visi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={\`px-5 py-2.5 rounded-2xl flex-row items-center \${filterMode === 'RECYCLED' ? 'bg-green-700 shadow-sm' : 'bg-white border-gray-100 border'}\`}
            onPress={() => { haptics.light(); setFilterMode('RECYCLED'); }}
            activeOpacity={0.8}
          >
            <Leaf size={14} color={filterMode === 'RECYCLED' ? '#ffffff' : '#6b7280'} className="mr-2" />
            <Text className={\`font-bold \${filterMode === 'RECYCLED' ? 'text-white' : 'text-gray-600'}\`}>
              Pārstrādāts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={\`px-5 py-2.5 rounded-2xl flex-row items-center \${filterMode === 'WITH_PRICES' ? 'bg-blue-700 shadow-sm' : 'bg-white border-gray-100 border'}\`}
            onPress={() => { haptics.light(); setFilterMode('WITH_PRICES'); }}
            activeOpacity={0.8}
          >
            <Calculator size={14} color={filterMode === 'WITH_PRICES' ? '#ffffff' : '#6b7280'} className="mr-2" />
            <Text className={\`font-bold \${filterMode === 'WITH_PRICES' ? 'text-white' : 'text-gray-600'}\`}>
              Ar norādītu cenu
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.category}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadScreenData(true)} tintColor="#000" />}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        ListEmptyComponent={() => {
          if (loadingScreen) {
            return (
              <View className="px-5 gap-4">
                {[1, 2, 3].map((i) => (
                  <View key={i} className="bg-gray-200 h-24 rounded-3xl opacity-50" />
                ))}
              </View>
            );
          }
          return (
            <View className="items-center px-5 py-12">
              <View className="w-16 h-16 bg-gray-100 rounded-3xl items-center justify-center mb-4">
                <Box size={28} color="#94a3b8" />
              </View>
              <Text className="text-gray-900 font-extrabold text-xl mb-1 text-center">Nekas nav atrasts</Text>
              <Text className="text-gray-500 font-medium text-center">
                Mēģiniet mainīt meklēšanu vai izvēlētos filtrus.
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const cat = item.category;
          const live = categoryData[cat];
          const staticData = CATEGORY_STATIC_DATA[cat] ?? {
            supplierCount: 0,
            hasRecycled: false,
            minPrice: null,
          };

          return (
            <CategoryCard
              category={cat}
              hasRecycled={staticData.hasRecycled}
              supplierCount={live ? live.supplierCount : staticData.supplierCount}
              minPrice={live ? live.minPrice : staticData.minPrice}
              onPress={() => handleCategoryPress(cat)}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

`;
  
  // Replace the entire return + stylesheet with the new return block and close the file
  code = code.replace(/  return \([\s\S]*$/, newRender);
  fs.writeFileSync('apps/mobile/app/(buyer)/catalog.tsx', code);
}
