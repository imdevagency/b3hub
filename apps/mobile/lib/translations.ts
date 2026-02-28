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

  tabs: {
    home: 'Sākums',
    profile: 'Profils',
  },
};

export type Translations = typeof lv;

/** Currently active translations – swap this export to change language. */
export const t = lv;
