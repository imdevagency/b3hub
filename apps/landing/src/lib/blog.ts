/**
 * Blog post data source.
 * Replace this file's content with CMS API calls (Sanity, Contentful, Hygraph, etc.)
 * when you integrate a headless CMS. The shape must match `BlogPost`.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;   // ISO date string
  author: string;
  category: string;
  readingTime: number; // minutes
  body: string;   // plain text / Markdown — swap for rich content when using CMS
}

const posts: BlogPost[] = [
  {
    slug: 'ka-digitalizet-buvniecibas-piegades',
    title: 'Kā digitalizēt celtniecības materiālu piegādes — praktiski soļi 2025. gadā',
    excerpt:
      'Lielākā daļa celtniecības uzņēmumu joprojām pārvalda pasūtījumus ar telefona zvaniem un Excel tabulām. Parādām, kā to mainīt bez lielām investīcijām.',
    date: '2025-03-15',
    author: 'B3Hub komanda',
    category: 'Nozares padomi',
    readingTime: 6,
    body: `Celtniecības nozare ir viena no pēdējām, kur digitalizācija vēl nav pilnībā sasniegusi operatīvo pusi. Pasūtījumi, piegādes apstiprinājumi, pavadraksti — viss joprojām bieži notiek pa telefonu un tiek reģistrēts vēlāk, ja vispār.\n\nŠajā rakstā apkopojam trīs konkrētus soļus, kā ieviest digitālos rīkus bez lieliem IT projektiem.`,
  },
  {
    slug: 'kā-izvēlēties-transporta-uzņēmumu',
    title: 'Kā izvēlēties uzticamu transporta partneri celtniecības objektam',
    excerpt:
      'Nepareizs transporta partneris var sabojāt visu projektu. Apkopojām galvenos kritērijus, pēc kuriem vērtēt kravas pārvadātājus Latvijā.',
    date: '2025-02-20',
    author: 'B3Hub komanda',
    category: 'Loģistika',
    readingTime: 5,
    body: `Transporta uzticamība tiešā veidā ietekmē celtniecības grafiku. Ja materiāli nepienāk laikā vai dokumenti ir nepilnīgi, objekts apstājas.\n\nLūk, uz ko pievērst uzmanību, izvēloties transporta partneri.`,
  },
  {
    slug: 'grants-smilts-pazindejums',
    title: 'Grants, šķembas, smiltis — kā izvēlēties pareizo materiālu projektam',
    excerpt:
      'Jaunie celtniecības projektu vadītāji bieži jautā par atšķirībām starp materiālu frakcijām. Šis raksts sniedz pamatus.',
    date: '2025-01-10',
    author: 'B3Hub komanda',
    category: 'Materiāli',
    readingTime: 8,
    body: `Izvēloties bēršanas materiālus celtniecībā, ir svarīgi saprast frakcijas, nosēšanos un attiecīgos standartus. Šajā rakstā aplūkojam biežāk izmantotās kategorijas un to pielietojumu.`,
  },
];

export function getAllPosts(): BlogPost[] {
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
