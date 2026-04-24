import { Redirect } from 'expo-router';

// Consolidated: this screen is now an alias for the materials catalog.
// All entry points (home service grid, "order again" CTA) navigate directly
// to /(buyer)/catalog or the material-order wizard. This file stays as a
// named route so deep links and any stale router.push calls don't 404.
export default function NewOrderScreen() {
  return <Redirect href="/(buyer)/catalog" />;
}
