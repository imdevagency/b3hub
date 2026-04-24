import type { Metadata } from 'next';
import { Container } from '@/components/marketing/layout/Container';

export const metadata: Metadata = {
  title: 'Privātuma politika',
  description: 'B3Hub privātuma politika — kā mēs apstrādājam jūsu personas datus.',
};

const sections = [
  {
    title: '1. Pārzinis',
    content:
      'Personas datu pārzinis ir B3Hub SIA (turpmāk — "B3Hub"), reģistrācijas numurs tiks norādīts pirms komercdarbības uzsākšanas, juridiskā adrese: Rīga, Latvija. Kontakts datu aizsardzības jautājumos: info@b3hub.lv.',
  },
  {
    title: '2. Kādi dati tiek vākti',
    content:
      'Mēs vācam datus, kurus jūs mums sniedzat reģistrācijas procesā (vārds, uzvārds, e-pasta adrese, tālruņa numurs, uzņēmuma informācija), pasūtījumu, piedāvājumu un transporta darbu izpildes laikā (piegādes adreses, darījumu vēsture, atrašanās vietas dati transporta izpildes laikā), kā arī tehniskie dati (IP adrese, ierīces identifikators, lietošanas žurnāli).',
  },
  {
    title: '3. Apstrādes nolūki un tiesiskais pamats',
    content:
      'Jūsu dati tiek apstrādāti šādiem nolūkiem: (a) līguma izpildei — pasūtījumu apstrāde, piegādes koordinācija, rēķinu sagatavošana (VDAR 6. panta 1. punkta b) apakšpunkts); (b) likumīgās interesēs — krāpšanas novēršana, platformas drošība, lietošanas statistika (VDAR 6. panta 1. punkta f) apakšpunkts); (c) piekrišanas pamata — mārketinga paziņojumi (VDAR 6. panta 1. punkta a) apakšpunkts).',
  },
  {
    title: '4. Datu glabāšanas termiņš',
    content:
      'Konta dati tiek glabāti visu konta darbības laiku un vēl 3 gadus pēc konta slēgšanas, ja vien likums neparedz citādi. Grāmatvedības dokumenti tiek glabāti 10 gadus saskaņā ar Latvijas Republikas likumdošanu. Atrašanās vietas dati transporta izpildes laikā tiek dzēsti 90 dienas pēc darba pabeigšanas.',
  },
  {
    title: '5. Datu apmaiņa',
    content:
      'Jūsu dati var tikt nodoti: (a) darījumu partneriem platformā (piegādātājiem, pārvadātājiem) tikai tādā apjomā, kas nepieciešams darījuma izpildei; (b) apstrādātājiem (mākoņpakalpojumu sniedzēji, maksājumu pakalpojumu sniedzēji), kas darbojas mūsu uzdevumā saskaņā ar datu apstrādes līgumiem; (c) valsts iestādēm likumā noteiktajos gadījumos. Dati netiek nodoti trešajām valstīm bez atbilstošām aizsardzības garantijām.',
  },
  {
    title: '6. Jūsu tiesības',
    content:
      'Jums ir tiesības piekļūt saviem datiem, labot tos, dzēst ("tiesības tikt aizmirstam"), ierobežot apstrādi, iebilst pret apstrādi, kā arī tiesības uz datu pārnesamību. Lai īstenotu šīs tiesības, sazinieties ar mums: info@b3hub.lv. Jums ir arī tiesības iesniegt sūdzību Datu valsts inspekcijā (www.dvi.gov.lv).',
  },
  {
    title: '7. Sīkdatnes',
    content:
      'B3Hub tīmekļa vietne izmanto sīkdatnes. Sīkāku informāciju skatiet mūsu Sīkdatņu politikā.',
  },
  {
    title: '8. Izmaiņas politikā',
    content:
      'Mēs paturam tiesības mainīt šo politiku. Par būtiskām izmaiņām tiks paziņots pa e-pastu vai platformā vismaz 30 dienas pirms to stāšanās spēkā. Pēdējais atjauninājums: 2025. gads.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <main className="bg-background text-foreground">
        {/* Hero */}
        <section className="border-b border-border pt-32 pb-16">
          <Container>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Juridiskā informācija
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">
              Privātuma politika
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Šī politika izskaidro, kādus personas datus B3Hub vāc, kāpēc tos apstrādā un kādas
              tiesības jums ir attiecībā uz saviem datiem.
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
    </>
  );
}
