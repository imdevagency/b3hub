import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogueService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
  }

  // ── Public read methods ──────────────────────────────────────────────────

  getMaterialCategories() {
    return this.prisma.materialCategoryDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  getMaterialFractions(category?: string) {
    return this.prisma.materialFractionDefinition.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  getVehicleCategories() {
    return this.prisma.vehicleServiceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  getWasteTypes(group?: string) {
    return this.prisma.wasteTypeDefinition.findMany({
      where: {
        isActive: true,
        ...(group ? { group } : {}),
      },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  // ── Seed — idempotent, uses upsert on code ────────────────────────────────

  private async seed() {
    await this.seedMaterialCategories();
    await this.seedMaterialFractions();
    await this.seedWasteTypes();
    await this.seedVehicleCategories();
  }

  private async seedMaterialCategories() {
    const categories = [
      { code: 'SAND',             label: 'Sand',              labelLv: 'Smiltis',              descriptionLv: 'Uzbēruma, celtnieku un filtrācijas smiltis',          densityTM3: 1.6,  defaultUnit: 'TONNE', iconKey: 'SAND',             sortOrder: 1 },
      { code: 'GRAVEL',           label: 'Gravel',            labelLv: 'Grants',               descriptionLv: 'Ceļu grants, drenāžas grants, šķembas',              densityTM3: 1.8,  defaultUnit: 'TONNE', iconKey: 'GRAVEL',           sortOrder: 2 },
      { code: 'STONE',            label: 'Crushed Stone',     labelLv: 'Šķembas / Akmens',     descriptionLv: 'Drupināts akmens, bruģakmens, laukakmens',           densityTM3: 2.7,  defaultUnit: 'TONNE', iconKey: 'STONE',            sortOrder: 3 },
      { code: 'CONCRETE',         label: 'Concrete',          labelLv: 'Betons',               descriptionLv: 'Gatavs betona maisījums, betona bloki',              densityTM3: 2.4,  defaultUnit: 'M3',    iconKey: 'CONCRETE',         sortOrder: 4 },
      { code: 'SOIL',             label: 'Soil / Fill',       labelLv: 'Augsne / Bērums',      descriptionLv: 'Tīrā augsne, melnzeme, dārza zeme, uzbēruma augsne', densityTM3: 1.7,  defaultUnit: 'TONNE', iconKey: 'SOIL',             sortOrder: 5 },
      { code: 'RECYCLED_CONCRETE',label: 'Recycled Concrete', labelLv: 'Pārstrādāts betons',   descriptionLv: 'Sasmalcināts betons no nojaukšanas darbiem (RC grants)', densityTM3: 1.5, defaultUnit: 'TONNE', iconKey: 'RECYCLED_CONCRETE', sortOrder: 6 },
      { code: 'RECYCLED_SOIL',    label: 'Recycled Soil',     labelLv: 'Pārstrādāta augsne',   descriptionLv: 'Pārstrādāta augsne celtniecības vajadzībām',          densityTM3: 1.5,  defaultUnit: 'TONNE', iconKey: 'RECYCLED_SOIL',    sortOrder: 7 },
      { code: 'ASPHALT',          label: 'Asphalt',           labelLv: 'Asfalts',              descriptionLv: 'Asfalts ceļiem un stāvvietām',                       densityTM3: 2.3,  defaultUnit: 'TONNE', iconKey: 'ASPHALT',          sortOrder: 8 },
      { code: 'CLAY',             label: 'Clay',              labelLv: 'Māls',                 descriptionLv: 'Māls hidroizolācijai un uzbērumiem',                  densityTM3: 1.8,  defaultUnit: 'TONNE', iconKey: 'CLAY',             sortOrder: 9 },
      { code: 'OTHER',            label: 'Other',             labelLv: 'Cits',                 descriptionLv: 'Citi celtniecības materiāli',                        densityTM3: 1.7,  defaultUnit: 'TONNE', iconKey: 'OTHER',            sortOrder: 10 },
    ];
    for (const cat of categories) {
      await this.prisma.materialCategoryDefinition.upsert({
        where: { code: cat.code },
        update: {},
        create: cat,
      });
    }
  }

  private async seedMaterialFractions() {
    const fractions = [
      // ── SAND — EN 12620 ────────────────────────────────────────────────────────
      { code: 'SAND_0_1',    category: 'SAND', label: '0–1 mm',       labelLv: '0–1 mm (smalka smiltis)',       descriptionLv: 'Smalka smiltis apmetumam un stuckatūrai', unit: 'TONNE', sortOrder: 1 },
      { code: 'SAND_0_2',    category: 'SAND', label: '0–2 mm',       labelLv: '0–2 mm (smalkā)',               descriptionLv: 'Smalkā smiltis apmestumam un apdarbiem', unit: 'TONNE', sortOrder: 2 },
      { code: 'SAND_0_4',    category: 'SAND', label: '0–4 mm',       labelLv: '0–4 mm (rupjā)',                descriptionLv: 'Rupjā smiltis pamatu un ceļu klājumam',  unit: 'TONNE', sortOrder: 3 },
      { code: 'SAND_CONCRETE',category: 'SAND', label: 'Betonsmiltis', labelLv: 'Betonsmiltis (0–4 mm mazgāta)', descriptionLv: 'Mazgāta smiltis betonam un mūrniecībai', unit: 'TONNE', sortOrder: 4 },
      { code: 'SAND_FILL',   category: 'SAND', label: 'Uzbēruma smiltis', labelLv: 'Uzbēruma smiltis',          descriptionLv: 'Jaukta granulometrija bērumam un drenāžai', unit: 'TONNE', sortOrder: 5 },
      { code: 'SAND_FILTER', category: 'SAND', label: 'Filtrācijas smiltis', labelLv: 'Filtrācijas smiltis',    descriptionLv: 'Tīra apala smiltis drenāžai un filtrācijai', unit: 'TONNE', sortOrder: 6 },
      { code: 'SAND_ANY',    category: 'SAND', label: 'Nav norādīts',  labelLv: 'Nav norādīts',                 unit: 'TONNE', sortOrder: 99 },
      // ── GRAVEL — EN 13043 / Latvian road standards ────────────────────────────
      { code: 'GRAVEL_0_4',  category: 'GRAVEL', label: '0–4 mm',   labelLv: '0–4 mm (smalks grants)',   descriptionLv: 'Smalks drupināts grants, drenāžas slānim',         unit: 'TONNE', sortOrder: 1 },
      { code: 'GRAVEL_4_8',  category: 'GRAVEL', label: '4–8 mm',   labelLv: '4–8 mm',                   descriptionLv: 'Drenāžas grants, filtrācijas slānis',              unit: 'TONNE', sortOrder: 2 },
      { code: 'GRAVEL_8_16', category: 'GRAVEL', label: '8–16 mm',  labelLv: '8–16 mm',                  descriptionLv: 'Drenāžas grants, pamata slānis',                   unit: 'TONNE', sortOrder: 3 },
      { code: 'GRAVEL_16_32',category: 'GRAVEL', label: '16–32 mm', labelLv: '16–32 mm',                 descriptionLv: 'Ceļu pamata grants, lielāks drenāžas grants',      unit: 'TONNE', sortOrder: 4 },
      { code: 'GRAVEL_32_63',category: 'GRAVEL', label: '32–63 mm', labelLv: '32–63 mm (rupjais grants)', descriptionLv: 'Pamatu drenāžas slānis, celšanās novēršana',       unit: 'TONNE', sortOrder: 5 },
      { code: 'GRAVEL_0_32', category: 'GRAVEL', label: '0–32 mm',  labelLv: '0–32 mm (ceļu grants)',    descriptionLv: 'Jaukts grants, celtniecības ceļiem un laukumiem', unit: 'TONNE', sortOrder: 6 },
      { code: 'GRAVEL_0_63', category: 'GRAVEL', label: '0–63 mm',  labelLv: '0–63 mm (šosejas grants)', descriptionLv: 'Jaukta frakcija ceļu pamata slāņiem',             unit: 'TONNE', sortOrder: 7 },
      { code: 'GRAVEL_ANY',  category: 'GRAVEL', label: 'Nav norādīts', labelLv: 'Nav norādīts',          unit: 'TONNE', sortOrder: 99 },
      // ── STONE / CRUSHED STONE — EN 13043 ──────────────────────────────────────
      { code: 'STONE_0_4',   category: 'STONE', label: '0–4 mm',   labelLv: '0–4 mm (akmeņu putekļi)', descriptionLv: 'Smalkas šķembas, skrubis',                        unit: 'TONNE', sortOrder: 1 },
      { code: 'STONE_4_8',   category: 'STONE', label: '4–8 mm',   labelLv: '4–8 mm',                  descriptionLv: 'Smalkās šķembas, betona pildmaterials',           unit: 'TONNE', sortOrder: 2 },
      { code: 'STONE_8_11',  category: 'STONE', label: '8–11 mm',  labelLv: '8–11 mm',                 descriptionLv: 'Asfaltu frakcija, betona pildmaterials',          unit: 'TONNE', sortOrder: 3 },
      { code: 'STONE_8_16',  category: 'STONE', label: '8–16 mm',  labelLv: '8–16 mm',                 descriptionLv: 'Standarta betona un asfalta šķembas',             unit: 'TONNE', sortOrder: 4 },
      { code: 'STONE_11_16', category: 'STONE', label: '11–16 mm', labelLv: '11–16 mm',                descriptionLv: 'Asfaltbetona virsmas slānis',                     unit: 'TONNE', sortOrder: 5 },
      { code: 'STONE_16_22', category: 'STONE', label: '16–22 mm', labelLv: '16–22 mm',                descriptionLv: 'Lielākas šķembas celtniecībai',                   unit: 'TONNE', sortOrder: 6 },
      { code: 'STONE_16_32', category: 'STONE', label: '16–32 mm', labelLv: '16–32 mm',                descriptionLv: 'Pamatu klāšanai un drenāžai',                     unit: 'TONNE', sortOrder: 7 },
      { code: 'STONE_32_63', category: 'STONE', label: '32–63 mm', labelLv: '32–63 mm (lielais akmens)', descriptionLv: 'Rupjās šķembas, pamatu drenāžai',              unit: 'TONNE', sortOrder: 8 },
      { code: 'STONE_63_125',category: 'STONE', label: '63–125 mm',labelLv: '63–125 mm (laukakmeņi)',  descriptionLv: 'Laukakmeņi, akmeņu krāvums',                     unit: 'TONNE', sortOrder: 9 },
      { code: 'STONE_COBBLE',category: 'STONE', label: 'Bruģakmens', labelLv: 'Bruģakmens',            descriptionLv: 'Apaļi vai apstrādāti bruģakmeņi',                unit: 'PIECE', sortOrder: 10 },
      { code: 'STONE_BOULDER',category: 'STONE',label: 'Laukakmeņi', labelLv: 'Laukakmeņi > 125 mm',   descriptionLv: 'Lieli laukakmeņi dekoratīviem un inženiertehnikas mērķiem', unit: 'TONNE', sortOrder: 11 },
      { code: 'STONE_ANY',   category: 'STONE', label: 'Nav norādīts', labelLv: 'Nav norādīts',         unit: 'TONNE', sortOrder: 99 },
      // ── CONCRETE — EN 206 strength classes ───────────────────────────────────
      { code: 'CONCRETE_C12_15',  category: 'CONCRETE', label: 'C12/15',  labelLv: 'C12/15',  descriptionLv: 'Viegls betons pamatu ieliešanai',               unit: 'M3', sortOrder: 1 },
      { code: 'CONCRETE_C16_20',  category: 'CONCRETE', label: 'C16/20',  labelLv: 'C16/20',  descriptionLv: 'Standarta betons plakņu un stabu betonēšanai', unit: 'M3', sortOrder: 2 },
      { code: 'CONCRETE_C20_25',  category: 'CONCRETE', label: 'C20/25',  labelLv: 'C20/25',  descriptionLv: 'Vispopulārākais standarts konstruktīvam betonam', unit: 'M3', sortOrder: 3 },
      { code: 'CONCRETE_C25_30',  category: 'CONCRETE', label: 'C25/30',  labelLv: 'C25/30',  descriptionLv: 'Augstākas stiprības betons slogotām konstrukcijām', unit: 'M3', sortOrder: 4 },
      { code: 'CONCRETE_C30_37',  category: 'CONCRETE', label: 'C30/37',  labelLv: 'C30/37',  descriptionLv: 'Inženierbūvju betons (sienas, tilti)',          unit: 'M3', sortOrder: 5 },
      { code: 'CONCRETE_C35_45',  category: 'CONCRETE', label: 'C35/45',  labelLv: 'C35/45',  descriptionLv: 'Augstās stiprības betons',                      unit: 'M3', sortOrder: 6 },
      { code: 'CONCRETE_BLOCK',   category: 'CONCRETE', label: 'Betona bloki', labelLv: 'Betona bloki', descriptionLv: 'Precast betona bloki un plātnes',      unit: 'PIECE', sortOrder: 7 },
      { code: 'CONCRETE_ANY',     category: 'CONCRETE', label: 'Nav norādīts', labelLv: 'Nav norādīts',                                                        unit: 'M3',    sortOrder: 99 },
      // ── SOIL ─────────────────────────────────────────────────────────────────
      { code: 'SOIL_FILL',    category: 'SOIL', label: 'Uzbēruma augsne', labelLv: 'Uzbēruma augsne (gruntsveidīgā)', descriptionLv: 'Tīra uzbēruma augsne, nav organiskā', unit: 'TONNE', sortOrder: 1 },
      { code: 'SOIL_TOPSOIL', category: 'SOIL', label: 'Melnzeme',         labelLv: 'Melnzeme (auglīgā)',             descriptionLv: 'Auglīgā augšējā augsnes kārta, dārzam', unit: 'TONNE', sortOrder: 2 },
      { code: 'SOIL_GARDEN',  category: 'SOIL', label: 'Dārza zeme',       labelLv: 'Dārza zeme',                     descriptionLv: 'Gatava maisīta dārza augsne',           unit: 'TONNE', sortOrder: 3 },
      { code: 'SOIL_SANDY',   category: 'SOIL', label: 'Smilšainā augsne', labelLv: 'Smilšainā augsne',               descriptionLv: 'Smilšaina vieglā augsne, drenas',       unit: 'TONNE', sortOrder: 4 },
      { code: 'SOIL_ANY',     category: 'SOIL', label: 'Nav norādīts',     labelLv: 'Nav norādīts',                                                               unit: 'TONNE', sortOrder: 99 },
      // ── RECYCLED CONCRETE — EN 13242 ─────────────────────────────────────────
      { code: 'RC_0_8',   category: 'RECYCLED_CONCRETE', label: '0–8 mm',   labelLv: '0–8 mm (RC smalks)',   descriptionLv: 'Smalks RC grants, stāvlaukumu klājumam',    unit: 'TONNE', sortOrder: 1 },
      { code: 'RC_8_32',  category: 'RECYCLED_CONCRETE', label: '8–32 mm',  labelLv: '8–32 mm (RC grants)',  descriptionLv: 'Standarta RC grants pamatu slāņiem',         unit: 'TONNE', sortOrder: 2 },
      { code: 'RC_32_63', category: 'RECYCLED_CONCRETE', label: '32–63 mm', labelLv: '32–63 mm (RC rupjais)',descriptionLv: 'Lielāks RC, pamatu drenāžai',               unit: 'TONNE', sortOrder: 3 },
      { code: 'RC_0_63',  category: 'RECYCLED_CONCRETE', label: '0–63 mm',  labelLv: '0–63 mm (RC jaukts)',  descriptionLv: 'Jaukts RC, laukumu un ceļu klājumam',       unit: 'TONNE', sortOrder: 4 },
      { code: 'RC_ANY',   category: 'RECYCLED_CONCRETE', label: 'Nav norādīts', labelLv: 'Nav norādīts',     unit: 'TONNE', sortOrder: 99 },
      // ── RECYCLED SOIL ─────────────────────────────────────────────────────────
      { code: 'RSOIL_SCREENED', category: 'RECYCLED_SOIL', label: 'Sijāta augsne',   labelLv: 'Sijāta pārstrādāta augsne', descriptionLv: 'Sijāta, bez akmeņiem un organiskā', unit: 'TONNE', sortOrder: 1 },
      { code: 'RSOIL_FILL',     category: 'RECYCLED_SOIL', label: 'Uzbērumam',       labelLv: 'Pārstrādāta uzbēruma augsne',                                                unit: 'TONNE', sortOrder: 2 },
      { code: 'RSOIL_ANY',      category: 'RECYCLED_SOIL', label: 'Nav norādīts',    labelLv: 'Nav norādīts',                                                               unit: 'TONNE', sortOrder: 99 },
      // ── ASPHALT ───────────────────────────────────────────────────────────────
      { code: 'ASPHALT_HOT',   category: 'ASPHALT', label: 'Karstais asfalts',  labelLv: 'Karstais asfalts (AC)',      descriptionLv: 'Karstais asfaltbetona maisījums (AC 11, AC 16, AC 22)',unit: 'TONNE', sortOrder: 1 },
      { code: 'ASPHALT_COLD',  category: 'ASPHALT', label: 'Aukstais asfalts',  labelLv: 'Aukstais asfalts (remontam)', descriptionLv: 'Aukstkausēts asfalts bedrīšu remontam',             unit: 'TONNE', sortOrder: 2 },
      { code: 'ASPHALT_RAP',   category: 'ASPHALT', label: 'Asfalta frēzējums', labelLv: 'Asfalta frēzējums (RAP)',    descriptionLv: 'Pārstrādāts asfalts frēzēšanas rezultātā',          unit: 'TONNE', sortOrder: 3 },
      { code: 'ASPHALT_ANY',   category: 'ASPHALT', label: 'Nav norādīts',      labelLv: 'Nav norādīts',                                                                   unit: 'TONNE', sortOrder: 99 },
      // ── CLAY ──────────────────────────────────────────────────────────────────
      { code: 'CLAY_WATERPROOF', category: 'CLAY', label: 'Hidroizolācijas māls', labelLv: 'Hidroizolācijas māls',  descriptionLv: 'Sārts māls dambju un aizsprosto celtniecībai',   unit: 'TONNE', sortOrder: 1 },
      { code: 'CLAY_FILL',       category: 'CLAY', label: 'Uzbēruma māls',        labelLv: 'Uzbēruma māls',          descriptionLv: 'Māls uzbērumam un planēšanai',                   unit: 'TONNE', sortOrder: 2 },
      { code: 'CLAY_ANY',        category: 'CLAY', label: 'Nav norādīts',          labelLv: 'Nav norādīts',                                                               unit: 'TONNE', sortOrder: 99 },
      // ── OTHER ─────────────────────────────────────────────────────────────────
      { code: 'OTHER_ANY', category: 'OTHER', label: 'Nav norādīts', labelLv: 'Nav norādīts', unit: 'TONNE', sortOrder: 99 },
    ];

    for (const frac of fractions) {
      await this.prisma.materialFractionDefinition.upsert({
        where: { code: frac.code },
        update: {},
        create: frac,
      });
    }
  }

  private async seedWasteTypes() {
    const wasteTypes = [
      // ── CONSTRUCTION_WASTE ─────────────────────────────────────────────────
      { code: 'CONCRETE',        label: 'Concrete / Rubble',   labelLv: 'Betons / Bruģis',        descriptionLv: 'Betona gabali, plātnes, mūrniecības gruži',        group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Hammer',        sortOrder: 1  },
      { code: 'BRICK',           label: 'Bricks / Masonry',    labelLv: 'Ķieģeļi / Mūris',        descriptionLv: 'Nojaukšanas ķieģeļi, bloki, fasādes materiāli',    group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Hammer',        sortOrder: 2  },
      { code: 'WOOD',            label: 'Timber / Formwork',   labelLv: 'Koks',                   descriptionLv: 'Dēļi, sijas, finiera atgriezumi, veidņi',           group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Trees',         sortOrder: 3  },
      { code: 'SOIL',            label: 'Excavation Soil',     labelLv: 'Augsne / Grunts',        descriptionLv: 'Z0/Z1 klases grunts, smilts, māls',               group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Layers',        sortOrder: 4  },
      { code: 'PLASTIC',         label: 'Plastic',             labelLv: 'Plastmasa',              descriptionLv: 'Caurules, pārsegi, maisi, polietilēns',             group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Package',       sortOrder: 5  },
      { code: 'PACKAGING_WASTE', label: 'Packaging',           labelLv: 'Iepakojums',             descriptionLv: 'Kartoni, paletes, plēve, big bags',                group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Package',       sortOrder: 6  },
      { code: 'ASPHALT',         label: 'Asphalt Demolition',  labelLv: 'Asfalta lauskas',        descriptionLv: 'Vecs asfalta segums, frēzējums (RAP)',             group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: true,  iconKey: 'Layers',        sortOrder: 7  },
      { code: 'MIXED',           label: 'Mixed Construction',  labelLv: 'Jaukti celtniec.',       descriptionLv: 'Šķirots celtniecības atk. — dažādi materiāli',    group: 'CONSTRUCTION_WASTE', groupLabelLv: 'Celtniecības atkritumi', isHazardous: false, isBuyback: false, iconKey: 'Trash2',        sortOrder: 8  },
      // ── LICENSED_WASTE ─────────────────────────────────────────────────────
      { code: 'HAZARDOUS',       label: 'Hazardous Waste',     labelLv: 'Bīstami atkritumi',      descriptionLv: 'Azbests, krāsas, šķīdinātāji, piesārņota grunts', group: 'LICENSED_WASTE',     groupLabelLv: 'Bīstami / Licencēti',   isHazardous: true,  isBuyback: false, iconKey: 'AlertTriangle', sortOrder: 1  },
      { code: 'WEEE',            label: 'Electronic Waste',    labelLv: 'Elektroatkritumi',       descriptionLv: 'Elektronikas, sadzīves tehnika, kabeļi',           group: 'LICENSED_WASTE',     groupLabelLv: 'Bīstami / Licencēti',   isHazardous: true,  isBuyback: false, iconKey: 'Zap',           sortOrder: 2  },
      { code: 'OIL_WASTE',       label: 'Oil & Lubricants',    labelLv: 'Eļļošanas atkritumi',    descriptionLv: 'Motoreļļa, hidraulikas šķidrums, degvielas atl.', group: 'LICENSED_WASTE',     groupLabelLv: 'Bīstami / Licencēti',   isHazardous: true,  isBuyback: false, iconKey: 'FlameKindling', sortOrder: 3  },
      { code: 'TIRES',           label: 'Tyres',               labelLv: 'Riepas',                 descriptionLv: 'Nolietotas auto un tehnikas riepas',               group: 'LICENSED_WASTE',     groupLabelLv: 'Bīstami / Licencēti',   isHazardous: false, isBuyback: false, iconKey: 'CircleDot',     sortOrder: 4  },
      // ── SECONDARY_MATERIALS ────────────────────────────────────────────────
      { code: 'METAL',           label: 'Scrap Metal',         labelLv: 'Metāls / Lūžņi',         descriptionLv: 'Profili, stiegrojums, čuguns, vara lūžņi',         group: 'SECONDARY_MATERIALS',groupLabelLv: 'Otrreizēji izejmateriāli', isHazardous: false, isBuyback: true, iconKey: 'Wrench',        sortOrder: 1  },
      { code: 'GREEN_WASTE',     label: 'Green Waste',         labelLv: 'Zaļie atkritumi',        descriptionLv: 'Zari, lapas, žogs, celmi, dārza atkritumi',        group: 'SECONDARY_MATERIALS',groupLabelLv: 'Otrreizēji izejmateriāli', isHazardous: false, isBuyback: false, iconKey: 'Leaf',         sortOrder: 2  },
    ];

    for (const wt of wasteTypes) {
      await this.prisma.wasteTypeDefinition.upsert({
        where: { code: wt.code },
        update: {},
        create: wt,
      });
    }
  }

  private async seedVehicleCategories() {
    const categories = [
      {
        code: 'CAR',
        label: 'Car',
        labelLv: 'Vieglā automašīna',
        description: 'Documents, parts, small items up to 50 kg',
        descriptionLv: 'Daļas, dokumenti — līdz 50 kg',
        eligibleVehicleTypes: ['CAR'],
        maxCapacityT: 0.05,
        fromPrice: 19,
        pricePerKm: 0.45,
        iconKey: 'CAR',
        sortOrder: 1,
      },
      {
        code: 'PICKUP_TRUCK',
        label: 'Pickup / Courier Van',
        labelLv: 'Pikaps / Furgonete',
        description: 'Up to 1 t · 2.5 m³',
        descriptionLv: 'līdz 1 t · 2.5 m³',
        eligibleVehicleTypes: ['PICKUP_TRUCK', 'VAN'],
        minCapacityT: 0.05,
        maxCapacityT: 1.0,
        fromPrice: 35,
        pricePerKm: 0.7,
        iconKey: 'PICKUP_TRUCK',
        sortOrder: 2,
      },
      {
        code: 'BOX_TRUCK',
        label: 'Box Truck',
        labelLv: 'Kravas furgons',
        description: 'Up to 3.5 t · 20 m³',
        descriptionLv: 'līdz 3.5 t · 20 m³',
        eligibleVehicleTypes: ['VAN'],
        minCapacityT: 1.0,
        maxCapacityT: 3.5,
        fromPrice: 79,
        pricePerKm: 1.2,
        iconKey: 'BOX_TRUCK',
        sortOrder: 3,
      },
      {
        code: 'TIPPER_SMALL',
        label: 'Small Tipper',
        labelLv: 'Mazā pašizgāzēja',
        description: 'Up to 5 t · 6 m³',
        descriptionLv: 'līdz 5 t · 6 m³',
        eligibleVehicleTypes: ['DUMP_TRUCK'],
        minCapacityT: 3.5,
        maxCapacityT: 5.0,
        fromPrice: 89,
        pricePerKm: 1.5,
        iconKey: 'TIPPER_SMALL',
        sortOrder: 4,
      },
      {
        code: 'TIPPER_LARGE',
        label: 'Large Tipper',
        labelLv: 'Lielā pašizgāzēja',
        description: 'Up to 15 t · 18 m³',
        descriptionLv: 'līdz 15 t · 18 m³',
        eligibleVehicleTypes: ['DUMP_TRUCK'],
        minCapacityT: 5.0,
        maxCapacityT: 15.0,
        fromPrice: 149,
        pricePerKm: 2.0,
        iconKey: 'TIPPER_LARGE',
        sortOrder: 5,
      },
      {
        code: 'FLATBED',
        label: 'Flatbed',
        labelLv: 'Platforma',
        description: 'Up to 20 t · 13.6 m length',
        descriptionLv: 'līdz 20 t · garums 13.6 m',
        eligibleVehicleTypes: ['FLATBED_TRUCK'],
        minCapacityT: 5.0,
        maxCapacityT: 20.0,
        fromPrice: 199,
        pricePerKm: 2.5,
        iconKey: 'FLATBED',
        sortOrder: 6,
      },
      {
        code: 'ARTICULATED_TIPPER',
        label: 'Articulated Tipper',
        labelLv: 'Puspiekabe',
        description: 'Up to 26 t · 22 m³',
        descriptionLv: 'līdz 26 t · 22 m³',
        eligibleVehicleTypes: ['SEMI_TRAILER'],
        minCapacityT: 15.0,
        maxCapacityT: 26.0,
        fromPrice: 219,
        pricePerKm: 3.0,
        iconKey: 'ARTICULATED_TIPPER',
        sortOrder: 7,
      },
    ];

    for (const cat of categories) {
      const { eligibleVehicleTypes, ...rest } = cat;
      await this.prisma.vehicleServiceCategory.upsert({
        where: { code: cat.code },
        update: {},
        create: { ...rest, eligibleVehicleTypes },
      });
    }
  }
}
