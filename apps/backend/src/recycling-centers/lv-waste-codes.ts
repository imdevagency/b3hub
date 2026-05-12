/**
 * Latvian / EU Waste Catalogue (EWC) codes for construction & demolition waste.
 * Source: EC Decision 2000/532/EC (European Waste Catalogue), as transposed in
 * Latvia by MK noteikumi Nr. 1032 "Atkritumu klasifikācijas noteikumi".
 *
 * Used to populate WasteRecord.lvWasteCode before APUS submission and on
 * waste management certificates.
 *
 * Format: "XX YY ZZ" (chapter · group · entry), e.g. "17 01 01".
 * Hazardous waste codes are suffixed with "*" per EWC convention.
 */
export const LV_WASTE_CODES: Record<string, string> = {
  // 17 – Construction and demolition wastes
  CONCRETE: '17 01 01', // Concrete
  BRICK: '17 01 02', // Bricks
  ASPHALT: '17 03 02', // Bituminous mixtures (non-hazardous)
  WOOD: '17 02 01', // Wood
  PLASTIC: '17 02 03', // Plastic
  METAL: '17 04 05', // Iron and steel (covers rebar, structural steel, scrap)

  // 17 05 – Soil and dredging spoil
  SOIL: '17 05 04', // Soil and stones (not contaminated)

  // 17 09 – Other construction and demolition wastes
  MIXED: '17 09 04', // Mixed construction and demolition wastes

  // 20 – Municipal wastes and similar
  GREEN_WASTE: '20 02 01', // Biodegradable waste (site clearing biomass)

  // 16 – Wastes not otherwise specified
  TIRES: '16 01 03', // End-of-life tyres
  PACKAGING_WASTE: '15 01 06', // Mixed packaging (film, cardboard, big bags)

  // 20 01 – Separately collected waste
  WEEE: '20 01 36', // Discarded electrical and electronic equipment (non-hazardous)

  // 13 – Oil wastes and wastes of liquid fuels (hazardous category)
  OIL_WASTE: '13 02 08*', // Other engine, gear and lubricating oils (hazardous)

  // 17 06 – Insulation materials and asbestos-containing waste (hazardous)
  HAZARDOUS: '17 06 05*', // Construction materials containing asbestos / contaminated soil
};

/**
 * Returns the EWC waste code for the given WasteType enum value.
 * Falls back to the "mixed construction" code when the type is unknown.
 */
export function getLvWasteCode(wasteType: string): string {
  return LV_WASTE_CODES[wasteType] ?? '17 09 04';
}

/**
 * Returns true if the waste code indicates a hazardous waste stream.
 * Hazardous codes end with "*" per EWC convention.
 */
export function isHazardousWasteCode(code: string): boolean {
  return code.endsWith('*');
}
