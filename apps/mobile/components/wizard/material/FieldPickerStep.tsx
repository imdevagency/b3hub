/**
 * FieldPickerStep — let the buyer pick a B3 Field location + date for PICKUP orders
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import {
  MapPin,
  Clock,
  ChevronRight,
  Package,
  Recycle,
  Truck,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react-native';
import { colors, radius, spacing } from '@/lib/theme';
import {
  b3Fields,
  type ApiMobileB3Field,
  type ApiPickupSlotMobile,
  type ApiFieldInventoryItem,
} from '@/lib/api';

const SERVICE_LABELS: Record<string, string> = {
  MATERIAL_PICKUP: 'Paņemšana',
  WASTE_DISPOSAL: 'Atkritumi',
  TRAILER_RENTAL: 'Piekabe',
};

const SERVICE_ICONS: Record<string, React.ElementType> = {
  MATERIAL_PICKUP: Package,
  WASTE_DISPOSAL: Recycle,
  TRAILER_RENTAL: Truck,
};

interface Props {
  selectedFieldId: string;
  selectedSlotId: string;
  onFieldChange: (fieldId: string) => void;
  onSlotChange: (slotId: string) => void;
  onPickupDateChange: (date: string) => void;
  /** When provided, shows stock availability check per field */
  requestedQty?: number;
}

// Next 7 days for slot selection
function getNextDays(count = 7): { iso: string; label: string; short: string }[] {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const label =
      i === 0
        ? 'Šodien'
        : i === 1
          ? 'Rīt'
          : d.toLocaleDateString('lv', { weekday: 'short', day: 'numeric', month: 'short' });
    const short = d.toLocaleDateString('lv', { weekday: 'short' });
    days.push({ iso, label, short });
  }
  return days;
}

export function FieldPickerStep({
  selectedFieldId,
  selectedSlotId,
  onFieldChange,
  onSlotChange,
  onPickupDateChange,
  requestedQty,
}: Props) {
  const [fields, setFields] = useState<ApiMobileB3Field[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [slots, setSlots] = useState<ApiPickupSlotMobile[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [inventory, setInventory] = useState<ApiFieldInventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const days = getNextDays(7);

  useEffect(() => {
    b3Fields
      .list()
      .then(setFields)
      .finally(() => setLoadingFields(false));
  }, []);

  useEffect(() => {
    if (!selectedFieldId) return;
    setLoadingSlots(true);
    setSlots([]);
    b3Fields
      .getSlots(selectedFieldId, selectedDate)
      .then(setSlots)
      .finally(() => setLoadingSlots(false));
  }, [selectedFieldId, selectedDate]);

  useEffect(() => {
    if (!selectedFieldId) {
      setInventory([]);
      return;
    }
    setLoadingInventory(true);
    b3Fields
      .getPublicInventory(selectedFieldId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoadingInventory(false));
  }, [selectedFieldId]);

  const handleDateSelect = (iso: string) => {
    setSelectedDate(iso);
    onPickupDateChange(iso);
    onSlotChange(''); // reset slot when date changes
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Field selection */}
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Inter_600SemiBold',
          color: colors.textMuted,
          marginBottom: spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Izvēlies punktu
      </Text>

      {loadingFields ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
      ) : fields.length === 0 ? (
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            marginVertical: spacing.xl,
          }}
        >
          Nav pieejamu B3 Field punktu
        </Text>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {fields.map((field) => {
            const selected = selectedFieldId === field.id;
            return (
              <Pressable
                key={field.id}
                onPress={() => {
                  onFieldChange(field.id);
                  onSlotChange('');
                }}
                style={{
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: selected ? '#F0FBF7' : colors.bgCard,
                  padding: spacing.base,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary + '22' : colors.bgMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPin size={20} color={selected ? colors.primary : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: 'Inter_600SemiBold',
                        color: colors.textPrimary,
                      }}
                    >
                      {field.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>
                      {field.address}, {field.city}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {field.services.map((svc) => {
                        const Icon = SERVICE_ICONS[svc] ?? Package;
                        return (
                          <View
                            key={svc}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 3,
                              backgroundColor: colors.bgMuted,
                              borderRadius: 100,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Icon size={10} color={colors.textMuted} />
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.textMuted,
                                fontFamily: 'Inter_500Medium',
                              }}
                            >
                              {SERVICE_LABELS[svc] ?? svc}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colors.primary,
                        }}
                      />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Inventory availability panel */}
      {selectedFieldId && (
        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bgCard,
            padding: spacing.base,
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
            }}
          >
            Krājumi šajā punktā
          </Text>
          {loadingInventory ? (
            <ActivityIndicator color={colors.primary} />
          ) : inventory.length === 0 ? (
            <Text
              style={{ fontSize: 13, color: colors.textDisabled, fontFamily: 'Inter_400Regular' }}
            >
              Informācija par krājumiem nav pieejama
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {inventory.map((item) => {
                const hasEnough = requestedQty == null || item.stockQty >= requestedQty;
                const stockColor =
                  item.stockQty === 0
                    ? (colors.danger ?? '#ef4444')
                    : !hasEnough
                      ? '#f59e0b'
                      : '#16a34a';
                return (
                  <View
                    key={item.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                  >
                    {item.stockQty > 0 && hasEnough ? (
                      <CheckCircle size={14} color={stockColor} />
                    ) : (
                      <AlertTriangle size={14} color={stockColor} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Inter_500Medium',
                          color: colors.textPrimary,
                        }}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <Text
                      style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: stockColor }}
                    >
                      {item.stockQty} {item.unit}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      €{item.pricePerUnit}/{item.unit}
                    </Text>
                  </View>
                );
              })}
              {requestedQty != null &&
                inventory.some((i) => i.stockQty > 0 && i.stockQty < requestedQty) && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                      backgroundColor: '#fffbeb',
                      borderRadius: radius.sm,
                      padding: 8,
                    }}
                  >
                    <AlertTriangle size={13} color="#d97706" />
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#92400e',
                        fontFamily: 'Inter_500Medium',
                        flex: 1,
                      }}
                    >
                      Dažiem materiāliem krājumi ir mazāki par pieprasīto daudzumu ({requestedQty})
                    </Text>
                  </View>
                )}
            </View>
          )}
        </View>
      )}

      {/* Date picker */}
      {selectedFieldId && (
        <>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: colors.textMuted,
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Izvēlies datumu
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          >
            {days.map((d) => {
              const sel = selectedDate === d.iso;
              return (
                <Pressable
                  key={d.iso}
                  onPress={() => handleDateSelect(d.iso)}
                  style={{
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.lg,
                    borderWidth: 2,
                    borderColor: sel ? colors.primary : colors.border,
                    backgroundColor: sel ? '#F0FBF7' : colors.bgCard,
                    alignItems: 'center',
                    minWidth: 72,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: sel ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      color: sel ? colors.primary : colors.textMuted,
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Slots */}
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: colors.textMuted,
              marginTop: spacing.md,
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Brīvie laiki
          </Text>

          {loadingSlots ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : slots.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.bgMuted,
                borderRadius: radius.lg,
                padding: spacing.base,
                alignItems: 'center',
              }}
            >
              <Clock size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                Šajā datumā nav brīvu laiku.{'\n'}Izvēlies citu datumu.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {slots.map((slot) => {
                const sel = selectedSlotId === slot.id;
                const full = slot.available === 0;
                const start = new Date(slot.slotStart).toLocaleTimeString('lv', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const end = new Date(slot.slotEnd).toLocaleTimeString('lv', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => !full && onSlotChange(slot.id)}
                    disabled={full}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: sel ? colors.primary : full ? colors.border : colors.border,
                      borderRadius: radius.lg,
                      backgroundColor: sel ? '#F0FBF7' : full ? colors.bgMuted : colors.bgCard,
                      padding: spacing.base,
                      opacity: full ? 0.5 : 1,
                    }}
                  >
                    <Clock
                      size={18}
                      color={sel ? colors.primary : colors.textMuted}
                      style={{ marginRight: spacing.md }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: 'Inter_600SemiBold',
                          color: full ? colors.textDisabled : colors.textPrimary,
                        }}
                      >
                        {start} – {end}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: full ? colors.textDisabled : colors.textMuted,
                        }}
                      >
                        {full ? 'Aizpildīts' : `${slot.available} brīvas vietas`}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: sel ? colors.primary : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sel && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.primary,
                          }}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
