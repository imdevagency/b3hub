import { Redirect, useLocalSearchParams } from 'expo-router';
export default function ProjectDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(buyer)/framework-contract/${id}` as any} />;
}
