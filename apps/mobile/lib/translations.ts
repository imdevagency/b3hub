export const lv = {
  welcome: {
    title: 'Laipni lūgti B3Hub',
    subtitle:
      'Jūsu visaptverošā platforma celtniecības materiāliem, pasūtījumiem un loģistikai.',
    getStarted: 'Sākt',
    signIn: 'Ieiet',
    features: {
      materials: {
        title: 'Materiāli',
        desc: 'Pārlūkot un pasūtīt celtniecības materiālus',
      },
      containers: {
        title: 'Konteineri',
        desc: 'Izsekot konteineriem un piegādēm',
      },
      recycling: {
        title: 'Pārstrāde',
        desc: 'Apsaimniekot atkritumus ilgtspējīgi',
      },
    },
  },

  login: {
    title: 'Laipni atgriezties',
    noAccount: 'Nav konta?',
    signUp: 'Reģistrēties',
    email: 'E-pasts',
    emailPlaceholder: 'janis@piemers.lv',
    password: 'Parole',
    passwordPlaceholder: 'Jūsu parole',
    forgotPassword: 'Aizmirsāt paroli?',
    signIn: 'Ieiet',
    failed: 'Pieteikšanās neizdevās',
    validation: {
      invalidEmail: 'Nederīga e-pasta adrese',
      passwordRequired: 'Parole ir nepieciešama',
    },
  },

  register: {
    title: 'Izveidot kontu',
    alreadyHaveOne: 'Jau ir konts?',
    signIn: 'Ieiet',
    back: '← Atpakaļ',
    firstName: 'Vārds',
    firstNamePlaceholder: 'Jānis',
    lastName: 'Uzvārds',
    lastNamePlaceholder: 'Bērziņš',
    email: 'E-pasts',
    emailPlaceholder: 'janis@piemers.lv',
    phone: 'Tālrunis (nav obligāti)',
    phonePlaceholder: '+371 20 000 000',
    accountType: 'Konta veids',
    password: 'Parole',
    passwordPlaceholder: 'Min. 8 rakstzīmes',
    confirmPassword: 'Apstiprināt paroli',
    confirmPasswordPlaceholder: 'Atkārtojiet paroli',
    createAccount: 'Izveidot kontu',
    failed: 'Reģistrācija neizdevās',
    userTypes: {
      BUYER: 'Pircējs',
      SUPPLIER: 'Piegādātājs',
      CARRIER: 'Pārvadātājs',
      RECYCLER: 'Pārstrādātājs',
    } as Record<string, string>,
    validation: {
      firstNameShort: 'Vārds ir pārāk īss',
      lastNameShort: 'Uzvārds ir pārāk īss',
      invalidEmail: 'Nederīga e-pasta adrese',
      passwordMin: 'Min. 8 rakstzīmes',
      passwordsMismatch: 'Paroles nesakrīt',
    },
  },

  home: {
    greeting: 'Labu dienu,',
    overview: 'Pārskats',
    quickActions: 'Ātrās darbības',
    stats: {
      materials: 'Materiāli',
      orders: 'Pasūtījumi',
      pending: 'Gaida',
    },
    actions: {
      materials: 'Materiāli',
      orders: 'Pasūtījumi',
      shipments: 'Sūtījumi',
      recycling: 'Pārstrāde',
    },
  },

  profile: {
    email: 'E-pasts',
    phone: 'Tālrunis',
    accountType: 'Konta veids',
    status: 'Statuss',
    account: 'Konts',
    signOut: 'Iziet',
  },

  skipHire: {
    title: 'Pasūtīt konteineru',
    step: 'Solis',
    errorTitle: 'Kļūda',
    error: 'Neizdevās veikt pasūtījumu. Lūdzu, mēģiniet vēlreiz.',
    step1: {
      title: 'Jūsu atrašanās vieta',
      subtitle: 'Ievadiet pasta indeksu vai pilsētu',
      placeholder: 'Piem. LV-1050 vai Rīga',
      error: 'Vismaz 3 rakstzīmes',
      next: 'Turpināt',
    },
    step2: {
      title: 'Atkritumu veids',
      subtitle: 'Ko plānojat izmest?',
      next: 'Turpināt',
      types: {
        MIXED: { label: 'Jaukts', desc: 'Vispārēji atkritumi', emoji: '🗂️' },
        GREEN_GARDEN: { label: 'Zaļie atkritumi', desc: 'Dārza atkritumi', emoji: '🌿' },
        CONCRETE_RUBBLE: { label: 'Gruži', desc: 'Betona un ķieģeļi', emoji: '🧱' },
        WOOD: { label: 'Koks', desc: 'Koka materiāli', emoji: '🪵' },
        METAL_SCRAP: { label: 'Metāls', desc: 'Metāla skrāpis', emoji: '⚙️' },
        ELECTRONICS_WEEE: { label: 'Elektronika', desc: 'WEEE atkritumi', emoji: '💻' },
      } as Record<string, { label: string; desc: string; emoji: string }>,
    },
    step3: {
      title: 'Konteinera izmērs',
      subtitle: 'Izvēlieties piemērotāko izmēru',
      next: 'Turpināt',
      popular: 'POPULĀRĀKAIS',
      sizes: {
        MINI: { label: 'Mini', volume: '2 m³', desc: 'Maza pārbūve' },
        MIDI: { label: 'Midi', volume: '4 m³', desc: 'Istabas atjaunošana' },
        BUILDERS: { label: 'Celtnieks', volume: '6 m³', desc: 'Pilna pārbūve' },
        LARGE: { label: 'Liels', volume: '8 m³', desc: 'Lieli projekti' },
      } as Record<string, { label: string; volume: string; desc: string }>,
    },
    step4: {
      title: 'Piegādes datums',
      subtitle: 'Kad piegādāt konteineru?',
      placeOrder: 'Veikt pasūtījumu',
      placing: 'Apstrādā...',
      summary: 'Pasūtījuma kopsavilkums',
      quick: {
        tomorrow: 'Rīt',
        in2days: 'Pēc 2 dienām',
        in3days: 'Pēc 3 dienām',
        nextWeek: 'Pēc nedēļas',
      },
    },
    confirmation: {
      title: '🎉 Pasūtījums veikts!',
      subtitle: 'Konteinera pasūtījums ir saņemts',
      orderNumber: 'Pasūtījuma Nr.',
      location: 'Piegādes vieta',
      size: 'Izmērs',
      wasteType: 'Atkritumu veids',
      deliveryDate: 'Piegādes datums',
      price: 'Cena',
      backHome: 'Atpakaļ uz sākumu',
      newOrder: 'Jauns pasūtījums',
    },
    myOrders: 'Mani pasūtījumi',
    noOrders: 'Nav pasūtījumu',
    noOrdersDesc: 'Veiciet savu pirmo konteinera pasūtījumu',
    orderNew: 'Pasūtīt konteineru',
  },

  tabs: {
    home: 'Sākums',
    orders: 'Pasūtījumi',
    profile: 'Profils',
  },
};

export type Translations = typeof lv;

/** Currently active translations – swap this export to change language. */
export const t = lv;
