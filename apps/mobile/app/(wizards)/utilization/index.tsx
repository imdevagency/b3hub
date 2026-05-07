/**
 * Utilization entry point — redirects to /disposal.
 *
 * The disposal wizard is the single adaptive flow for all construction waste.
 * This file is kept so old deep-links and any remaining navigation refs
 * continue to work without a 404.
 */
import { Redirect } from 'expo-router';

export default function UtilizationRedirect() {
  return <Redirect href="/disposal" />;
}
