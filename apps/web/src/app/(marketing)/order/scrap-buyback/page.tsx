import { ScrapBuybackWizard } from '@/components/order/wizards/ScrapBuybackWizard';

export const metadata = {
  title: 'Metāllūžņi — Bilt',
  description:
    'Nododiet metāllūžņus officiālos pieņemšanas punktos. Salīdziniet cenas un pieteikt izbraukšanu.',
};

export default function ScrapBuybackPage() {
  return <ScrapBuybackWizard mode="public" />;
}

