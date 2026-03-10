import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Menu } from 'lucide-react-native';

interface TopBarProps {
  title?: string;
  accentColor: string;
  onMenuPress: () => void;
}

export function TopBar({ title = 'B3Hub', accentColor, onMenuPress }: TopBarProps) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        onPress={onMenuPress}
        hitSlop={10}
        style={styles.menuBtn}
        activeOpacity={0.7}
      >
        <Menu size={24} color="#374151" />
      </TouchableOpacity>
      <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  menuBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
