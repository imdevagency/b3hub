import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  StyleProp,
  TextInput,
  View,
  TextInputProps,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

interface SearchBarProps extends TextInputProps {
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  onPress?: () => void;
  editable?: boolean;
}

export const SearchBar = React.forwardRef<TextInput, SearchBarProps>(
  (
    {
      style,
      placeholder = 'Meklēt pakalpojumus, materiālus...',
      onPress,
      editable = false,
      value,
      onChangeText,
      ...props
    },
    ref,
  ) => {
    const handlePress = () => {
      if (!editable && onPress) {
        haptics.light();
        onPress();
      }
    };

    const containerStyle: StyleProp<ViewStyle> = [
      {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 12,
      },
      style,
    ];

    if (editable) {
      return (
        <View style={containerStyle}>
          <Search size={20} color="#9ca3af" strokeWidth={2} />
          <TextInput
            ref={ref}
            style={{
              fontSize: 16,
              fontFamily: 'Inter_500Medium',
              paddingVertical: 0,
              flex: 1,
              color: '#111827',
            }}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            value={value}
            onChangeText={onChangeText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            {...props}
          />
          {value && value.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onChangeText?.('');
              }}
              hitSlop={14}
            >
              <View style={{ backgroundColor: '#e5e7eb', padding: 4, borderRadius: 999 }}>
                <X size={12} color="#374151" strokeWidth={3} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={handlePress} style={containerStyle}>
        <Search size={20} color="#6b7280" strokeWidth={2} />
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 16, color: '#6b7280', flex: 1 }}>
          {placeholder}
        </Text>
      </TouchableOpacity>
    );
  },
);

SearchBar.displayName = 'SearchBar';
