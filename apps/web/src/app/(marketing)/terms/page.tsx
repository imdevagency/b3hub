import type { Metadata } from 'next';
import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Container } from '@/components/marketing/layout/Container';

export const metadata: Metadata = {
  title: 'Lietošanas noteikumi',
  description: 'B3Hub platformas lietošanas noteikumi un pakalpojumu sniegšanas nosacījumi.',
};

const sections = [
  {
    title: '1. Vispārēji noteikumi',
    content:
      'Šie lietošanas noteikumi regulē B3Hub platformas (tīmekļa vietne un mobilā lietotne) izmantošanu. Reģistrējoties un izmantojot platformu, jūs piekrītat šiem noteikumiem. Ja nepiekrītat, lūdzam neizmantot platformu. B3Hub ir starpniecības platforma, kas savieno materiālu pircējus, piegādātājus un transporta pakalpojumu sniedzējus. B3Hub nav darījumu puse starp lietotājiem.',
  },
  {
    title: '2. Reģistrācija un konts',
    content:
      'Platformas izmantošanai nepieciešama reģistrācija. Jūs apliecinājat, ka sniedzat patiesus un aktuālus datus. Konta akreditācijas datu drošība ir jūsu atbildība. Uzņēmumu pārstāvjiem ir jābūt pilnvarotiem darboties uzņēmuma vārdā. B3Hub ir tiesības apturēt vai dzēst kontus, kuros konstatēta noteikumu pārkāpšana vai krāpnieciska darbība.',
  },
  {
    title: '3. Platformas izmantošana',
    content:
      'Platformu drīkst izmantot tikai likumīgiem mērķiem. Ir aizliegts: ievietot maldinošu vai nepatiesas informāciju; mēģināt apiet platformas drošības pasākumus; vākt citu lietotāju datus bez atļaujas; izmantot automatizētus rīkus satura ievākšanai (web scraping); ievietot materiālu piedāvājumus, kuru piegāde nav nodrošināma.',
  },
  {
    title: '4. Darījumi un maksājumi',
    content:
      'B3Hub nodrošina rīkus darījumu organizēšanai, taču darījuma saistības rodas tieši starp pircēju un piegādātāju / transporta pakalpojumu sniedzēju. Maksājumu nosacījumi tiek saskaņoti starp darījumu pusēm platformā noteiktajos ietvaros. Komisijas maksa par izpildītajiem darījumiem tiek norādīta platformas cenu lapā.',
  },
  {
    title: '5. Satura publicēšana',
    content:
      'Publicējot materiālu piedāvājumus, cenas pieprasījumus vai atsauksmes, jūs apliecināt, ka informācija ir patiesa. Jūs piešķirat B3Hub neekskluzīvu, bezatlīdzības licenci izmantot jūsu publicēto saturu platformas darbībai un mārketingam. B3Hub paturas tiesības noņemt saturu, kas pārkāpj noteikumus vai trešo pušu tiesības.',
  },
  {
    title: '6. Atbildības ierobežojums',
    content:
      'B3Hub nesniedz garantijas par materiālu vai transporta pakalpojumu kvalitāti, kurus piedāvā platformas lietotāji. B3Hub atbildība ir ierobežota ar komisijas maksas apmēru, kas saistīts ar konkrēto darījumu. B3Hub nav atbildīgs par netiešiem zaudējumiem, peļņas zaudējumu vai darījumu aizkavēšanos.',
  },
  {
    title: '7. Intelektuālais īpašums',
    content:
      'Platformas dizains, programmatūra, preču zīmes un saturs, ko radījis B3Hub, ir B3Hub intelektuālā īpašuma objekti. To reproducēšana vai izmantošana komerciālos nolūkos bez rakstiskas atļaujas ir aizliegta.',
  },
  {
    title: '8. Noteikumu izmaiņas',
    content:
      'B3Hub ir tiesības grozīt šos noteikumus. Par būtiskām izmaiņām tiks paziņots vismaz 30 dienas iepriekš. Turpinot izmantot platformu pēc izmaiņu spēkā stāšanās, jūs piekrītat jaunajiem noteikumiem. Pēdējās izmaiņas: 2025. gads.',
  },
  {
    title: '9. Piemērojamais likums',
    content:
      'Šiem noteikumiem piemērojams Latvijas Republikas likums. Strīdi tiek risināti Latvijas Republikas tiesās. Patērētāji var izmantot arī alternatīvās strīdu risināšanas iespējas.',
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground">
        {/* Hero */}
        <section className="border-b border-border pt-32 pb-16">
          <Container>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Juridiskā informācija
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">
              Lietošanas noteikumi
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Šie noteikumi regulē B3Hub platformas izmantošanu. Lūdzu izlasiet tos pirms
              reģistrācijas un platformas lietošanas uzsākšanas.
            </p>
          </Container>
        </section>

        {/* Content */}
        <Container as="section" className="py-24">
          <div className="max-w-3xl space-y-12">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-lg font-semibold text-foreground mb-3">{s.title}</h2>
                <p className="text-muted-foreground leading-7">{s.content}</p>
              </div>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
