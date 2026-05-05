/**
 * Partner Contracts — /dashboard/admin/partner-contracts
 *
 * Generate pre-filled onboarding partnership agreements for:
 *   • Piegādātāji   (Suppliers)
 *   • Pārvadātāji   (Carriers)
 *   • Pārstrādātāji (Recyclers)
 *   • Skip-hire operatori
 *
 * Admin selects a company (or enters details manually), reviews the
 * pre-filled contract, and prints it to PDF via the browser print dialog.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetCompanies, type AdminCompany } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  ChevronRight,
  FileText,
  Package,
  Printer,
  Recycle,
  RefreshCw,
  Search,
  Truck,
  UserPen,
  X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractType = 'SUPPLIER' | 'CARRIER' | 'RECYCLER' | 'SKIP_HIRE';

interface ContractFields {
  partnerLegalName: string;
  partnerRegNo: string;
  partnerAddress: string;
  partnerRepresentative: string;
  partnerRepresentativeTitle: string;
  commissionPct: string;
  contractNumber: string;
  contractDate: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ContractType,
  { label: string; companyTypes: string[]; icon: React.ElementType; defaultCommission: string }
> = {
  SUPPLIER: {
    label: 'Piegādātāji',
    companyTypes: ['SUPPLIER', 'HYBRID'],
    icon: Package,
    defaultCommission: '8',
  },
  CARRIER: {
    label: 'Pārvadātāji',
    companyTypes: ['CARRIER', 'HYBRID'],
    icon: Truck,
    defaultCommission: '10',
  },
  RECYCLER: {
    label: 'Pārstrādātāji',
    companyTypes: ['RECYCLER'],
    icon: Recycle,
    defaultCommission: '5',
  },
  SKIP_HIRE: {
    label: 'Skip-hire',
    companyTypes: ['CARRIER', 'HYBRID', 'SUPPLIER'],
    icon: Package,
    defaultCommission: '12',
  },
};

const CONTRACT_TITLES: Record<ContractType, string> = {
  SUPPLIER: 'Materiālu Piegādātāja Sadarbības Līgums',
  CARRIER: 'Transporta Pakalpojumu Sadarbības Līgums',
  RECYCLER: 'Atkritumu Pieņemšanas un Pārstrādes Sadarbības Līgums',
  SKIP_HIRE: 'Skip-hire Operatora Sadarbības Līgums',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function todayLv() {
  return new Date().toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isoToLv(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = [
    'janvārī',
    'februārī',
    'martā',
    'aprīlī',
    'maijā',
    'jūnijā',
    'jūlijā',
    'augustā',
    'septembrī',
    'oktobrī',
    'novembrī',
    'decembrī',
  ];
  return `${parseInt(d)}. ${months[parseInt(m) - 1]} ${y}`;
}

function nextContractNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `B3H-${y}${m}-001`;
}

// ── Contract clause generators ────────────────────────────────────────────────

function supplierClauses(commission: string): string {
  return `
<h2>1. Līguma priekšmets</h2>
<p>1.1. B3 Hub SIA (turpmāk — <em>Platforma</em>) nodrošina Partnerim piekļuvi digitālajai tirdzniecības platformai B3 Hub, kurā Partneris ir tiesīgs izvietot savus materiālu un pakalpojumu piedāvājumus.</p>
<p>1.2. Partneris apņemas sniegt pakalpojumus atbilstoši Platformas noteikumiem un šī Līguma nosacījumiem.</p>

<h2>2. Komisija un norēķini</h2>
<p>2.1. Par katru sekmīgi izpildītu pasūtījumu Platforma ietur komisijas maksu <strong>${commission}%</strong> apmērā no pasūtījuma neto vērtības (bez PVN).</p>
<p>2.2. Izmaksas veic 14 (četrpadsmit) darba dienu laikā pēc pasūtījuma pabeigšanas uz Partnera norādīto bankas kontu.</p>
<p>2.3. Komisijas likme var tikt pārskatīta ar 30 dienu iepriekšēju rakstveida paziņojumu.</p>

<h2>3. Partnera pienākumi</h2>
<p>3.1. Uzturēt aktuālu un precīzu cenu un preču sarakstu Platformā.</p>
<p>3.2. Apstiprināt vai atteikt saņemtos pasūtījumus 2 (divu) stundu laikā darba dienās.</p>
<p>3.3. Nodrošināt piegādes kvalitāti atbilstoši pasūtītāja norādītajiem parametriem.</p>
<p>3.4. Pēc piegādes augšupielādēt Platformā visus nepieciešamos dokumentus (pavadzīme, svara zīme u.c.).</p>
<p>3.5. Uzturēt spēkā esošas licences un atļaujas materiālu tirdzniecībai un piegādei.</p>

<h2>4. Platformas pienākumi</h2>
<p>4.1. Nodrošināt Partnerim drošu piekļuvi Platformas vadības panelim.</p>
<p>4.2. Veikt pasūtījumu un rēķinu apstrādi.</p>
<p>4.3. Sniegt tehnisko atbalstu darba laikā (P–Pk, 9:00–18:00).</p>

<h2>5. Datu apstrāde</h2>
<p>5.1. Puses apņemas apstrādāt personas datus atbilstoši VDAR un Latvijas Fizisko personu datu apstrādes likumam.</p>
<p>5.2. Platforma apstrādā Partnera darbinieku kontaktinformāciju pasūtījumu izpildes vajadzībām.</p>

<h2>6. Konfidencialitāte</h2>
<p>6.1. Puses apņemas neizpaust trešajām personām Līgumā iekļauto komercnoslēpumu un komisijas likmju informāciju 3 (trīs) gadus pēc Līguma izbeigšanas.</p>

<h2>7. Līguma termiņš un izbeigšana</h2>
<p>7.1. Līgums stājas spēkā no parakstīšanas brīža uz 1 (vienu) gadu un automātiski atjaunojas uz nākamo gadu, ja neviena Puse 30 dienas pirms termiņa beigām nav iesniegusi rakstisku atteikumu.</p>
<p>7.2. Jebkura Puse var izbeigt Līgumu, iesniedzot rakstisku paziņojumu 30 dienas iepriekš.</p>
<p>7.3. Platforma ir tiesīga apturēt vai izbeigt Līgumu nekavējoties, ja Partneris pārkāpj Līguma noteikumus vai Platformas lietošanas nosacījumus.</p>

<h2>8. Piemērojamās tiesību normas un strīdu izšķiršana</h2>
<p>8.1. Līgumam piemērojamas Latvijas Republikas tiesību normas.</p>
<p>8.2. Strīdi tiek risināti sarunu ceļā. Ja vienošanās nav panākama 30 dienu laikā, strīds nododams izskatīšanai Rīgas tiesā.</p>
`;
}

function carrierClauses(commission: string): string {
  return `
<h2>1. Līguma priekšmets</h2>
<p>1.1. Platforma nodrošina Pārvadātājam piekļuvi transporta darbu platformai, kurā Pārvadātājs var pieņemt un izpildīt kravas pārvadāšanas pasūtījumus.</p>
<p>1.2. Pārvadātājs apņemas izpildīt pieņemtos darbus savlaicīgi, profesionāli un atbilstoši Latvijas Republikas normatīvajiem aktiem.</p>

<h2>2. Atalgojums un norēķini</h2>
<p>2.1. Par katru izpildīto transporta darbu Platforma ietur koordinācijas maksu <strong>${commission}%</strong> apmērā no darba pasūtītāja samaksātās summas.</p>
<p>2.2. Izmaksas veic katras nedēļas otrdienā par iepriekšējās nedēļas (pirmd.–svētd.) pabeigto darbu kopsummu.</p>
<p>2.3. Maksājumi tiek veikti uz Pārvadātāja Platformā reģistrēto bankas kontu.</p>

<h2>3. Pārvadātāja pienākumi</h2>
<p>3.1. Pieņemtos darbus sākt izpildi norādītajā laikā; kavēšanās gadījumā nekavējoties informēt Platformu.</p>
<p>3.2. Nodrošināt GPS izsekošanu visā transporta darba laikā, izmantojot Platformas mobilo lietotni.</p>
<p>3.3. Pie pasūtītāja un saņēmēja iegūt digitālo piegādes apliecinājumu (foto + paraksts lietotnē).</p>
<p>3.4. Uzturēt spēkā esošu kravas transporta licenci un kravas civiltiesiskās atbildības apdrošināšanu (min. 300 000 EUR).</p>
<p>3.5. Ievērot Latvijas ceļu satiksmes un autotransporta normatīvos aktus.</p>

<h2>4. Platformas pienākumi</h2>
<p>4.1. Nodrošināt Pārvadātājam regulāru darbu plūsmu atbilstoši pieejamajiem pasūtījumiem.</p>
<p>4.2. Veikt darbu koordināciju un klientu komunikāciju.</p>
<p>4.3. Nodrošināt automātisko dokumentu ģenerēšanu (pavadzīmes, piegādes apliecinājumi).</p>

<h2>5. Atbildība</h2>
<p>5.1. Pārvadātājs ir atbildīgs par preces bojājumiem vai pazaudēšanu transportēšanas laikā līdz spēkā esošā apdrošinājuma summas apmēram.</p>
<p>5.2. Par katru no Pārvadātāja vainas radītu pasūtījuma atcelšanu Platforma ir tiesīga ieturēt soda naudu 20 EUR apmērā.</p>

<h2>6. Konfidencialitāte un datu aizsardzība</h2>
<p>6.1. Pārvadātājs apņemas neizpaust trešajām personām pasūtītāju kontaktinformāciju un pasūtījumu saturu.</p>
<p>6.2. GPS dati tiek glabāti Platformā 12 mēnešus strīdu risināšanas vajadzībām.</p>

<h2>7. Līguma termiņš un izbeigšana</h2>
<p>7.1. Līgums ir beztermiņa un stājas spēkā no parakstīšanas brīža.</p>
<p>7.2. Jebkura Puse var izbeigt Līgumu ar 14 dienu rakstisku paziņojumu.</p>
<p>7.3. Platforma ir tiesīga nekavējoties apturēt Pārvadātāja kontu, ja tiek konstatēts būtisks Līguma pārkāpums.</p>

<h2>8. Piemērojamās tiesību normas</h2>
<p>8.1. Līgumam piemērojamas Latvijas Republikas tiesību normas. Strīdi tiek risināmi Latvijas Republikas tiesās.</p>
`;
}

function recyclerClauses(commission: string): string {
  return `
<h2>1. Līguma priekšmets</h2>
<p>1.1. Pārstrādātājs nodrošina B3 Hub klientiem iespēju tiešsaistē rezervēt un nogādāt būvgružus un citus atkritumu veidus Pārstrādātāja licencētajā objektā.</p>
<p>1.2. Platforma darbojas kā digitālais starpnieks, kas apstrādā rezervācijas, novirza klientus un veic norēķinus.</p>

<h2>2. Atalgojums un norēķini</h2>
<p>2.1. Platforma ietur platformas maksu <strong>${commission}%</strong> no katra klienta veiktā maksājuma.</p>
<p>2.2. Atlikušā summa tiek pārskaitīta Pārstrādātājam 7 darba dienu laikā pēc klienta piegādes un svēršanas protokola aizpildīšanas.</p>

<h2>3. Pārstrādātāja pienākumi</h2>
<p>3.1. Uzturēt spēkā esošu A vai B kategorijas atkritumu apsaimniekošanas atļauju visu Līguma darbības laiku.</p>
<p>3.2. Pieņemt Platformas klientu piegādes atbilstoši rezervētajam laika logam darba dienās.</p>
<p>3.3. Katrā pieņemšanā izsvērt kravas un augšupielādēt Platformā svēršanas protokolu (datums, masa, atkritumu veids).</p>
<p>3.4. Pieņemšanas sertifikātu augšupielādēt Platformā 24 stundu laikā pēc pieņemšanas.</p>
<p>3.5. Nekavējoties informēt Platformu par licences apturēšanu vai jebkādiem regulatīviem ierobežojumiem.</p>

<h2>4. Platformas pienākumi</h2>
<p>4.1. Nodrošināt Pārstrādātājam vadības paneli rezervāciju, svēršanas protokolu un finanšu pārvaldībai.</p>
<p>4.2. Klientu informēšana un piegādes koordinācija.</p>
<p>4.3. Automātiska pieņemšanas sertifikātu nosūtīšana klientiem.</p>

<h2>5. Licences prasības un normatīvā atbilstība</h2>
<p>5.1. Pārstrādātājs apliecina, ka tā darbība atbilst Atkritumu apsaimniekošanas likumam un citiem piemērojamajiem normatīvajiem aktiem.</p>
<p>5.2. Pārstrādātājs uzņemas pilnu atbildību par atkritumu apstrādi pēc to pieņemšanas.</p>

<h2>6. Līguma termiņš</h2>
<p>6.1. Līgums ir beztermiņa un stājas spēkā no parakstīšanas brīža.</p>
<p>6.2. Jebkura Puse var izbeigt Līgumu ar 30 dienu rakstisku paziņojumu.</p>
<p>6.3. Platforma ir tiesīga nekavējoties apturēt sadarbību, ja tiek konstatēta licences neatbilstība.</p>

<h2>7. Piemērojamās tiesību normas</h2>
<p>7.1. Latvijas Republikas tiesību normas. Strīdi tiek risināmi Latvijas Republikas tiesās pēc Platformas juridiskās adreses.</p>
`;
}

function skipHireClauses(commission: string): string {
  return `
<h2>1. Līguma priekšmets</h2>
<p>1.1. Operators nodrošina B3 Hub platformai savu skip un konteineru floti un apņemas izpildīt platformas klientu pasūtījumus atbilstoši šim Līgumam.</p>
<p>1.2. Platforma darbojas kā pasūtījumu starpnieks un veic klientu norēķinus.</p>

<h2>2. Atalgojums un norēķini</h2>
<p>2.1. Platforma ietur koordinācijas maksu <strong>${commission}%</strong> no katra pabeigta pasūtījuma vērtības (bez PVN).</p>
<p>2.2. Izmaksas veic 14 darba dienu laikā pēc pasūtījuma pabeigšanas.</p>

<h2>3. Operatora pienākumi</h2>
<p>3.1. Uzturēt Platformā aktuālu flotes informāciju (konteineru veidi, izmēri, daudzums, pieejamība).</p>
<p>3.2. Piegādāt konteinerus norādītajā adresē 5 (piecu) darba dienu laikā no pasūtījuma saņemšanas.</p>
<p>3.3. Savākt konteinerus pamatnomas perioda beigās vai pēc klienta pieprasījuma 48 stundu laikā.</p>
<p>3.4. Augšupielādēt Platformā piegādes un savākšanas fotogrāfijas kā pierādījumus.</p>
<p>3.5. Uzturēt konteineru tīrību un drošu tehnisko stāvokli. Informēt klientu par pieļaujamajiem atkritumu veidiem un svara ierobežojumiem.</p>

<h2>4. Platformas pienākumi</h2>
<p>4.1. Nodrošināt Operatoram vadības paneli pasūtījumu, flotes un finanšu pārvaldībai.</p>
<p>4.2. Klientu uzskaite, maksājumu apstrāde un klientu komunikācija.</p>
<p>4.3. Automātiska dokumentu ģenerēšana (pavadzīmes, nomas apliecinājumi).</p>

<h2>5. Papildu maksa</h2>
<p>5.1. Par nomas perioda pārsniegšanu Operators ir tiesīgs iekasēt papildu maksu atbilstoši Platformas apstiprināto cenu sarakstam.</p>
<p>5.2. Pārslogotu konteineru (virs norādītā svara) izņemšanas izmaksas sedz klients.</p>

<h2>6. Līguma termiņš</h2>
<p>6.1. Līgums ir beztermiņa un stājas spēkā no parakstīšanas brīža.</p>
<p>6.2. Jebkura Puse var izbeigt Līgumu ar 14 dienu rakstisku paziņojumu.</p>
<p>6.3. Aktīvo pasūtījumu laikā Līguma izbeigšana neietekmē to izpildi.</p>

<h2>7. Piemērojamās tiesību normas</h2>
<p>7.1. Latvijas Republikas tiesību normas. Strīdi tiek risināmi Latvijas Republikas tiesās.</p>
`;
}

const CLAUSE_GENERATORS: Record<ContractType, (commission: string) => string> = {
  SUPPLIER: supplierClauses,
  CARRIER: carrierClauses,
  RECYCLER: recyclerClauses,
  SKIP_HIRE: skipHireClauses,
};

// ── Print CSS ─────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  body { font-family: 'Times New Roman', Georgia, serif; max-width: 780px; margin: 0 auto; padding: 50px 40px; color: #111; line-height: 1.65; font-size: 13px; }
  .contract-header { text-align: center; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 2px solid #111; }
  .contract-header .b3-logo { font-size: 11px; font-family: Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #555; margin-bottom: 10px; }
  .contract-header h1 { font-size: 17px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; }
  .contract-header .contract-meta { font-size: 11px; color: #555; font-family: Arial, sans-serif; }
  .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 28px 0; border: 1px solid #ddd; padding: 20px; border-radius: 4px; background: #fafafa; }
  .party-label { font-size: 10px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.08em; color: #777; margin-bottom: 8px; }
  .parties-grid p { margin: 3px 0; font-size: 12.5px; }
  h2 { font-size: 13px; font-weight: bold; margin-top: 24px; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
  p { margin: 4px 0; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 60px; padding-top: 24px; border-top: 1px solid #ccc; }
  .sig-block .sig-label { font-size: 11px; font-family: Arial, sans-serif; color: #555; margin-bottom: 4px; }
  .sig-block .sig-line { border-top: 1px solid #999; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #555; }
`;

// ── Print handler ─────────────────────────────────────────────────────────────

function printContract(contractHtml: string, title: string) {
  const win = window.open('', '_blank', 'width=950,height=800');
  if (!win) {
    alert('Lūdzu atļaujiet uznirstošos logus šai lapai un mēģiniet vēlreiz.');
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html lang="lv"><head><meta charset="UTF-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${contractHtml}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── ContractPreview ───────────────────────────────────────────────────────────

interface PreviewProps {
  type: ContractType;
  fields: ContractFields;
}

function buildContractHtml(type: ContractType, fields: ContractFields): string {
  const title = CONTRACT_TITLES[type];
  const clauses = CLAUSE_GENERATORS[type](fields.commissionPct || TYPE_CONFIG[type].defaultCommission);
  const dateStr = fields.contractDate ? isoToLv(fields.contractDate) : todayLv();

  return `
<div class="contract-header">
  <div class="b3-logo">B3 Hub SIA · Platforma celtniecības loģistikai</div>
  <h1>${title}</h1>
  <div class="contract-meta">
    Nr. ${fields.contractNumber || 'B3H-______-___'} &nbsp;·&nbsp; Rīga, ${dateStr}
  </div>
</div>

<div class="parties-grid">
  <div>
    <div class="party-label">Platforma</div>
    <p><strong>B3 Hub SIA</strong></p>
    <p>Reģ. nr.: 40203&nbsp;_______</p>
    <p>Juridiskā adrese: Rīga, Latvija</p>
    <p>PVN reģ.: LV40203_______</p>
    <p>Pārstāvis: ______________________</p>
    <p>Amats: ______________________</p>
  </div>
  <div>
    <div class="party-label">Partneris</div>
    <p><strong>${fields.partnerLegalName || '______________________________'}</strong></p>
    <p>Reģ. nr.: ${fields.partnerRegNo || '______________________'}</p>
    <p>Juridiskā adrese: ${fields.partnerAddress || '______________________________'}</p>
    <p>Pārstāvis: ${fields.partnerRepresentative || '______________________'}</p>
    <p>Amats: ${fields.partnerRepresentativeTitle || '______________________'}</p>
  </div>
</div>

${clauses}

<div class="signatures">
  <div class="sig-block">
    <div class="sig-label">B3 Hub SIA</div>
    <div class="sig-line">Paraksts &nbsp; / &nbsp; Vārds, uzvārds &nbsp; / &nbsp; Datums</div>
  </div>
  <div class="sig-block">
    <div class="sig-label">${fields.partnerLegalName || 'Partners'}</div>
    <div class="sig-line">Paraksts &nbsp; / &nbsp; Vārds, uzvārds &nbsp; / &nbsp; Datums</div>
  </div>
</div>
`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPartnerContractsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [contractType, setContractType] = useState<ContractType>('SUPPLIER');
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<AdminCompany | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [fields, setFields] = useState<ContractFields>({
    partnerLegalName: '',
    partnerRegNo: '',
    partnerAddress: '',
    partnerRepresentative: '',
    partnerRepresentativeTitle: 'Direktors',
    commissionPct: TYPE_CONFIG.SUPPLIER.defaultCommission,
    contractNumber: nextContractNumber(),
    contractDate: todayIso(),
  });

  const previewRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [isLoading, user, router]);

  // ── Load companies ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetCompanies(token);
      setCompanies(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Switch contract type ────────────────────────────────────────────────────

  function handleTypeChange(type: ContractType) {
    setContractType(type);
    setSelectedCompany(null);
    setSearch('');
    setFields((f) => ({
      ...f,
      commissionPct: TYPE_CONFIG[type].defaultCommission,
    }));
  }

  // ── Select company ──────────────────────────────────────────────────────────

  function selectCompany(c: AdminCompany) {
    setSelectedCompany(c);
    setManualMode(false);
    setFields((f) => ({
      ...f,
      partnerLegalName: c.legalName || c.name,
      partnerAddress: c.city ? `${c.city}, Latvija` : '',
      partnerRegNo: '',
      partnerRepresentative: '',
    }));
  }

  function clearSelection() {
    setSelectedCompany(null);
    setFields((f) => ({
      ...f,
      partnerLegalName: '',
      partnerAddress: '',
      partnerRegNo: '',
      partnerRepresentative: '',
    }));
  }

  // ── Print ───────────────────────────────────────────────────────────────────

  function handlePrint() {
    const html = buildContractHtml(contractType, fields);
    printContract(html, CONTRACT_TITLES[contractType]);
  }

  // ── Filtered company list ───────────────────────────────────────────────────

  const filteredCompanies = companies.filter((c) => {
    const matchesType = TYPE_CONFIG[contractType].companyTypes.includes(c.companyType);
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.legalName.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) return null;

  return (
    <div className="p-6 xl:p-8 space-y-6">
      <PageHeader
        title="Partneru Līgumi"
        description="Ģenerējiet aizpildītus sadarbības līgumus jaunu partneru piesaistīšanai"
        action={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunināt
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-6 items-start">
        {/* ── Left panel: configurator ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Contract type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Līguma veids</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {(Object.entries(TYPE_CONFIG) as [ContractType, (typeof TYPE_CONFIG)[ContractType]][]).map(
                ([type, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeChange(type)}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                        contractType === type
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-foreground hover:border-foreground/40'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                      {cfg.label}
                    </button>
                  );
                },
              )}
            </CardContent>
          </Card>

          {/* Company picker */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                Uzņēmums
                {!manualMode && (
                  <button
                    type="button"
                    onClick={() => { setManualMode(true); clearSelection(); }}
                    className="text-xs font-normal text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <UserPen className="size-3" /> Ievadīt manuāli
                  </button>
                )}
                {manualMode && (
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="text-xs font-normal text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Building2 className="size-3" /> No saraksta
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {!manualMode && (
                <>
                  {selectedCompany ? (
                    <div className="flex items-center gap-3 rounded-xl border-2 border-foreground bg-foreground/5 px-3 py-2.5">
                      <Building2 className="size-4 text-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {selectedCompany.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{selectedCompany.city}</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Meklēt uzņēmumu..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1 -mx-1 px-1">
                        {loading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 rounded-lg" />
                          ))
                        ) : filteredCompanies.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Nav uzņēmumu ar šo tipu
                          </p>
                        ) : (
                          filteredCompanies.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCompany(c)}
                              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/60 transition-colors"
                            >
                              <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {c.name}
                                </p>
                                <p className="text-xs text-muted-foreground">{c.city}</p>
                              </div>
                              <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Override / manual fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Līguma dati</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Juridiskais nosaukums</Label>
                <Input
                  value={fields.partnerLegalName}
                  onChange={(e) => setFields((f) => ({ ...f, partnerLegalName: e.target.value }))}
                  placeholder="SIA „Uzņēmums""
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Reģ. numurs</Label>
                  <Input
                    value={fields.partnerRegNo}
                    onChange={(e) => setFields((f) => ({ ...f, partnerRegNo: e.target.value }))}
                    placeholder="40203XXXXXX"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Komisija %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={fields.commissionPct}
                    onChange={(e) => setFields((f) => ({ ...f, commissionPct: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Juridiskā adrese</Label>
                <Input
                  value={fields.partnerAddress}
                  onChange={(e) => setFields((f) => ({ ...f, partnerAddress: e.target.value }))}
                  placeholder="Iela 1, Rīga, LV-1001"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pārstāvis (vārds uzvārds)</Label>
                <Input
                  value={fields.partnerRepresentative}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, partnerRepresentative: e.target.value }))
                  }
                  placeholder="Jānis Bērziņš"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amats</Label>
                <Input
                  value={fields.partnerRepresentativeTitle}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, partnerRepresentativeTitle: e.target.value }))
                  }
                  placeholder="Direktors"
                  className="h-9 text-sm"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Līguma numurs</Label>
                  <Input
                    value={fields.contractNumber}
                    onChange={(e) => setFields((f) => ({ ...f, contractNumber: e.target.value }))}
                    placeholder="B3H-202501-001"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datums</Label>
                  <Input
                    type="date"
                    value={fields.contractDate}
                    onChange={(e) => setFields((f) => ({ ...f, contractDate: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <Button onClick={handlePrint} className="w-full mt-2" size="sm">
                <Printer className="size-4 mr-1.5" />
                Drukāt / Lejupielādēt PDF
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Right panel: live contract preview ───────────────────────────── */}
        <Card className="min-h-150">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Priekšskatījums</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">
                {CONTRACT_TITLES[contractType]}
              </Badge>
            </div>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1.5" />
              Drukāt PDF
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Contract preview rendered with print-like styles */}
            <div
              ref={previewRef}
              id="contract-preview"
              className="p-8 xl:p-12 font-serif text-[13px] leading-relaxed text-gray-900 max-w-190 mx-auto"
            >
              {/* Header */}
              <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
                <p className="text-[10px] font-sans tracking-widest uppercase text-gray-500 mb-2">
                  B3 Hub SIA · Platforma celtniecības loģistikai
                </p>
                <h1 className="text-[17px] font-bold uppercase tracking-wide text-gray-900">
                  {CONTRACT_TITLES[contractType]}
                </h1>
                <p className="text-[11px] text-gray-500 font-sans mt-2">
                  Nr. {fields.contractNumber || 'B3H-______-___'} &nbsp;·&nbsp; Rīga,{' '}
                  {fields.contractDate ? isoToLv(fields.contractDate) : todayLv()}
                </p>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-6 mb-6 p-5 bg-gray-50 border border-gray-200 rounded">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-gray-500 mb-2">
                    Platforma
                  </p>
                  <p className="font-bold">B3 Hub SIA</p>
                  <p className="text-gray-700">Reģ. nr.: 40203 _______</p>
                  <p className="text-gray-700">Juridiskā adrese: Rīga, Latvija</p>
                  <p className="text-gray-700">Pārstāvis: ______________________</p>
                  <p className="text-gray-700">Amats: ______________________</p>
                </div>
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-gray-500 mb-2">
                    Partneris
                  </p>
                  <p className="font-bold">
                    {fields.partnerLegalName || (
                      <span className="text-gray-400 font-normal italic">Nav norādīts</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Reģ. nr.:{' '}
                    {fields.partnerRegNo || (
                      <span className="text-gray-400 italic">______________________</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Jur. adrese:{' '}
                    {fields.partnerAddress || (
                      <span className="text-gray-400 italic">______________________________</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Pārstāvis:{' '}
                    {fields.partnerRepresentative || (
                      <span className="text-gray-400 italic">______________________</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Amats: {fields.partnerRepresentativeTitle || '______________________'}
                  </p>
                </div>
              </div>

              {/* Clauses */}
              <div
                className="
                  [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2
                  [&_h2]:border-b [&_h2]:border-gray-200 [&_h2]:pb-1
                  [&_p]:mb-1.5 [&_p]:text-justify [&_p]:text-gray-800
                  [&_strong]:font-bold
                  [&_em]:italic
                "
                dangerouslySetInnerHTML={{
                  __html: CLAUSE_GENERATORS[contractType](
                    fields.commissionPct || TYPE_CONFIG[contractType].defaultCommission,
                  ),
                }}
              />

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 mt-16 pt-6 border-t border-gray-300">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-gray-500 mb-1">
                    B3 Hub SIA
                  </p>
                  <div className="border-t border-gray-400 mt-10 pt-2">
                    <p className="text-[11px] text-gray-500 font-sans">
                      Paraksts / Vārds, uzvārds / Datums
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-gray-500 mb-1">
                    {fields.partnerLegalName || 'Partners'}
                  </p>
                  <div className="border-t border-gray-400 mt-10 pt-2">
                    <p className="text-[11px] text-gray-500 font-sans">
                      Paraksts / Vārds, uzvārds / Datums
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
