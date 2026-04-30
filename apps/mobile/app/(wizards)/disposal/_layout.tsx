import { Stack } from 'expo-router';
import { DisposalProvider } from '@/lib/disposal-context';
import { SCREEN } from '@/lib/transitions';

// Required: tells expo-router the canonical initial route for this segment.
// Without this, react-navigation's useNavigationBuilder can enter an else-branch
// where stateBeforeInitialization is undefined, causing `state.stale` crash.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function DisposalLayout() {
  return (
    <DisposalProvider>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </DisposalProvider>
  );
}
