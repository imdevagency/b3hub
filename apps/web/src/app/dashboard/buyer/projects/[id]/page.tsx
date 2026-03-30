import { redirect } from 'next/navigation';

export default function BuyerProjectDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/projects/${params.id}`);
}
