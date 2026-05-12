/**
 * RentalOrderCard — generic driver-facing order card for all rental services.
 *
 * Works with SkipHireOrder, ToiletCabinOrder, and future RentalOrder types by
 * accepting a normalized `RentalCardOrder` shape. Each driver screen maps its
 * domain-specific order type to this shape before rendering.
 *
 * Features:
 *   - Order number + StatusPill header
 *   - Address line
 *   - Configurable meta badges (size, type, count, date, etc.)
 *   - Notes box
 *   - Navigate / Call action buttons
 *   - Primary action button (Deliver → In Use → Collect) driven by `statusFlow`
 *   - Optional overdue warning banner + invoice button
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Navigation2, Phone, Calendar, FileText, AlertTriangle } from 'lucide-react-native';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors } from '@/lib/theme';
import { formatDateNumeric } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────

/** A single icon + text badge shown in the card meta row */
export interface MetaBadge {
  icon: React.ReactNode;
  label: string;
}

/** A status transition this card can trigger */
export interface StatusAction {
  /** The status this action transitions the order TO */
  toStatus: string;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
}

/** Normalized order shape consumed by RentalOrderCard */
export interface RentalCardOrder {
  id: string;
  orderNumber: string;
  status: string;
  /** Full address string shown under the order number */
  addressLine: string;
  deliveryDate: string | Date;
  contactPhone?: string | null;
  notes?: string | null;
  overdueDays?: number;
  overdueFeeEur?: number;
  /** Extra meta badges (size, type, count, etc.) rendered in the meta row */
  badges?: MetaBadge[];
}

export interface RentalOrderCardProps {
  order: RentalCardOrder;
  /** Map of status → display config used by StatusPill */
  statusConfig: Record<string, { label: string; bg: string; color: string }>;
  /**
   * Ordered list of possible actions. The first action whose `fromStatus`
   * matches the order's current status is rendered as the primary button.
   * Use `fromStatus` matching by looking at each action's toStatus predecessors
   * — instead, define which statuses trigger which action via the `when` field.
   */
  actions: Array<StatusAction & { when: string | string[] }>;
  onStatusUpdate: (id: string, toStatus: string) => void;
  updating: boolean;
  onOverdueInvoice?: (id: string) => void;
  invoicing?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

function openMaps(addressLine: string) {
  const enc = encodeURIComponent(addressLine);
  const url = Platform.OS === 'ios' ? `maps:?q=${enc}` : `geo:0,0?q=${enc}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${enc}`));
}

// ── Component ─────────────────────────────────────────────────────

export function RentalOrderCard({
  order,
  statusConfig,
  actions,
  onStatusUpdate,
  updating,
  onOverdueInvoice,
  invoicing,
}: RentalOrderCardProps) {
  const statusInfo = statusConfig[order.status] ?? {
    label: order.status,
    bg: '#f3f4f6',
    color: colors.textSecondary,
  };

  const overdueDays = order.overdueDays ?? 0;
  const overdueFeeEur = order.overdueFeeEur ?? 0;

  // Find the first matching action for the current order status
  const activeAction = actions.find((a) => {
    const triggers = Array.isArray(a.when) ? a.when : [a.when];
    return triggers.includes(order.status);
  });

  const handleActionPress = () => {
    if (!activeAction) return;
    Alert.alert(activeAction.confirmTitle, activeAction.confirmMessage, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Apstiprināt',
        onPress: () => onStatusUpdate(order.id, activeAction.toStatus),
      },
    ]);
  };

  return (
    <View style={s.card}>
      {/* Overdue warning banner */}
      {overdueDays > 0 && (
        <View style={s.overdueBanner}>
          <AlertTriangle size={14} color="#92400e" />
          <Text style={s.overdueBannerText}>
            {overdueDays} {overdueDays === 1 ? 'diena' : 'dienas'} pāri · €
            {overdueFeeEur.toFixed(2)} pap. maksa
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.orderNumber}>#{order.orderNumber}</Text>
            <StatusPill
              label={statusInfo.label}
              bg={statusInfo.bg}
              color={statusInfo.color}
              size="sm"
            />
          </View>
          <Text style={s.addressText} numberOfLines={2}>
            {order.addressLine}
          </Text>
        </View>
      </View>

      {/* Meta badges row */}
      <View style={s.metaWrap}>
        {order.badges?.map((badge, i) => (
          <View key={i} style={s.metaItem}>
            {badge.icon}
            <Text style={s.metaItemText}>{badge.label}</Text>
          </View>
        ))}
        <View style={s.metaItem}>
          <Calendar size={14} color={colors.textMuted} />
          <Text style={s.metaItemText}>{formatDateNumeric(order.deliveryDate)}</Text>
        </View>
      </View>

      {/* Notes */}
      {order.notes ? (
        <View style={s.notesBox}>
          <Text style={s.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      {/* Navigate + Call */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => openMaps(order.addressLine)}
          activeOpacity={0.8}
        >
          <Navigation2 size={16} color="#fff" />
          <Text style={s.navBtnText}>Rādīt ceļu</Text>
        </TouchableOpacity>
        {order.contactPhone ? (
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(`tel:${order.contactPhone}`)}
            activeOpacity={0.8}
          >
            <Phone size={16} color="#000" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Primary status action */}
      {activeAction ? (
        <TouchableOpacity
          style={[s.actionBtnPrimary, updating && { opacity: 0.5 }]}
          onPress={handleActionPress}
          disabled={updating}
          activeOpacity={0.8}
        >
          {updating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.actionBtnPrimaryText}>{activeAction.label}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* Overdue invoice button */}
      {overdueDays > 0 && !!onOverdueInvoice ? (
        <TouchableOpacity
          style={[s.invoiceBtn, invoicing && { opacity: 0.5 }]}
          onPress={() => onOverdueInvoice(order.id)}
          disabled={invoicing}
          activeOpacity={0.8}
        >
          {invoicing ? (
            <ActivityIndicator color="#92400e" size="small" />
          ) : (
            <>
              <FileText size={16} color="#92400e" />
              <Text style={s.invoiceBtnText}>Izrakstīt papildu rēķinu</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  overdueBannerText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  metaItemText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  notesBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
  },
  notesText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  callBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  invoiceBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
  },
});
