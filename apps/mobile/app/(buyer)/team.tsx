/**
 * team.tsx — Buyer: Company team members & permissions
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Users, UserPlus, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiCompanyMember,
  type InviteMemberInput,
  type MemberPermissions,
} from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';

// ── helpers ────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Īpašnieks',
  MANAGER: 'Vadītājs',
  MEMBER: 'Dalībnieks',
  DRIVER: 'Šoferis',
};

const PERM_META: Array<{ key: keyof MemberPermissions; label: string; sub: string }> = [
  {
    key: 'permCreateContracts',
    label: 'Ietvarlīgumi',
    sub: 'Izveidot un pārvaldīt projektu līgumus',
  },
  {
    key: 'permReleaseCallOffs',
    label: 'Izsaukt pasūtījumus',
    sub: 'Izsaukt darbus no projektu pozīcijām',
  },
  {
    key: 'permManageOrders',
    label: 'Pasūtījumi',
    sub: 'Izveidot, apstiprināt, atcelt pasūtījumus',
  },
  { key: 'permViewFinancials', label: 'Finanses', sub: 'Skatīt rēķinus, cenas un apgrozījumu' },
  { key: 'permManageTeam', label: 'Komanda', sub: 'Uzaicināt un pārvaldīt komandas locekļus' },
];

// ── Permission toggles sheet ────────────────────────────────────

function PermissionsSheet({
  member,
  visible,
  onClose,
  onSaved,
  token,
}: {
  member: ApiCompanyMember | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: ApiCompanyMember) => void;
  token: string;
}) {
  const { showToast } = useToast();
  const [perms, setPerms] = useState<MemberPermissions>({
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: false,
    permViewFinancials: false,
    permManageTeam: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setPerms({
        permCreateContracts: member.permCreateContracts,
        permReleaseCallOffs: member.permReleaseCallOffs,
        permManageOrders: member.permManageOrders,
        permViewFinancials: member.permViewFinancials,
        permManageTeam: member.permManageTeam,
      });
    }
  }, [member]);

  async function handleSave() {
    if (!member) return;
    setSaving(true);
    try {
      const updated = await api.companyMembers.updatePermissions(member.id, perms, token);
      onSaved(updated);
      showToast('Tiesības atjauninātas', 'success');
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!member) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${member.firstName} ${member.lastName}`}
      subtitle={member.email ?? undefined}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
        <Text style={styles.permSection}>Tiesības</Text>

        {PERM_META.map(({ key, label, sub }) => (
          <View key={key} style={styles.permRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permLabel}>{label}</Text>
              <Text style={styles.permSub}>{sub}</Text>
            </View>
            <Switch
              value={perms[key]}
              onValueChange={(v) => setPerms((prev) => ({ ...prev, [key]: v }))}
              trackColor={{ false: '#e5e7eb', true: '#111827' }}
              thumbColor="#fff"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Saglabāt tiesības</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Invite modal ────────────────────────────────────────────────

function InviteModal({
  visible,
  onClose,
  onInvited,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  onInvited: (member: ApiCompanyMember) => void;
  token: string;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<InviteMemberInput>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: false,
    permViewFinancials: false,
    permManageTeam: false,
  });
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      permCreateContracts: false,
      permReleaseCallOffs: false,
      permManageOrders: false,
      permViewFinancials: false,
      permManageTeam: false,
    });
  }

  async function handleInvite() {
    if (!form.email.trim()) {
      showToast('Ievadiet e-pasta adresi', 'error');
      return;
    }
    if (!form.firstName.trim()) {
      showToast('Ievadiet vārdu', 'error');
      return;
    }
    if (!form.lastName.trim()) {
      showToast('Ievadiet uzvārdu', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.companyMembers.invite(form, token);
      onInvited(res.member);
      const msg = res.isNew
        ? `Uzaicinājums nosūtīts uz ${form.email}`
        : `${form.firstName} pievienots komandai`;
      showToast(msg, 'success');
      reset();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Uzaicināt dalībnieku" scrollable>
      <Text style={styles.fieldLabel}>E-pasts *</Text>
      <TextInput
        style={styles.input}
        value={form.email}
        onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="dalibnieks@uznemums.lv"
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.fieldLabel}>Vārds *</Text>
      <TextInput
        style={styles.input}
        value={form.firstName}
        onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))}
        placeholder="Jānis"
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.fieldLabel}>Uzvārds *</Text>
      <TextInput
        style={styles.input}
        value={form.lastName}
        onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))}
        placeholder="Bērziņš"
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.fieldLabel}>Telefons</Text>
      <TextInput
        style={styles.input}
        value={form.phone ?? ''}
        onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
        keyboardType="phone-pad"
        placeholder="+371 xxxxxxxx"
        placeholderTextColor="#9ca3af"
      />

      <Text style={[styles.permSection, { marginTop: 16 }]}>Sākotnējās tiesības</Text>
      {PERM_META.map(({ key, label, sub }) => (
        <View key={key} style={styles.permRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.permLabel}>{label}</Text>
            <Text style={styles.permSub}>{sub}</Text>
          </View>
          <Switch
            value={(form as any)[key] ?? false}
            onValueChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
            trackColor={{ false: '#e5e7eb', true: '#111827' }}
            thumbColor="#fff"
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleInvite}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Uzaicināt</Text>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Member card ─────────────────────────────────────────────────

function MemberCard({
  member,
  canManage,
  onEdit,
  onRemove,
}: {
  member: ApiCompanyMember;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOwner = member.companyRole === 'OWNER';
  const activePerms = PERM_META.filter(({ key }) => member[key]);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {member.firstName.charAt(0)}
            {member.lastName.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>
            {member.firstName} {member.lastName}
          </Text>
          <Text style={styles.memberEmail} numberOfLines={1}>
            {member.email}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <View style={[styles.roleBadge, isOwner && { backgroundColor: '#1f2937' }]}>
            <Text style={[styles.roleText, isOwner && { color: '#fff' }]}>
              {ROLE_LABEL[member.companyRole ?? 'MEMBER'] ?? member.companyRole}
            </Text>
          </View>
          {canManage && !isOwner && (
            <>
              <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Shield size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRemove}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {activePerms.length > 0 && (
        <TouchableOpacity
          style={styles.permToggle}
          onPress={() => {
            haptics.light();
            setExpanded((v) => !v);
          }}
        >
          <Text style={styles.permToggleText}>{activePerms.length} tiesības</Text>
          {expanded ? (
            <ChevronUp size={13} color="#6b7280" />
          ) : (
            <ChevronDown size={13} color="#6b7280" />
          )}
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.permChips}>
          {activePerms.map(({ key, label }) => (
            <View key={key} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function TeamScreen() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<ApiCompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editMember, setEditMember] = useState<ApiCompanyMember | null>(null);

  // Owners or users with team-manage permission can invite / edit members.
  // If user has no company yet they are treated as prospective owner.
  const canManage =
    !user?.companyRole || user?.companyRole === 'OWNER' || user?.permManageTeam === true;

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setLoading(true);
      try {
        const data = await api.companyMembers.list(token);
        setMembers(data);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Kļūda ielādējot komandu', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  function confirmRemove(member: ApiCompanyMember) {
    haptics.medium();
    Alert.alert(
      'Noņemt dalībnieku',
      `Vai tiešām noņemt ${member.firstName} ${member.lastName} no komandas?`,
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Noņemt',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.companyMembers.remove(member.id, token ?? '');
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
              showToast('Dalībnieks noņemts', 'success');
            } catch (e: unknown) {
              showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenContainer standalone topInset={0}>
      {/* header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderLeft}>
          <Users size={20} color="#111827" />
          <Text style={styles.pageTitle}>Komanda</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => {
              haptics.light();
              setShowInvite(true);
            }}
          >
            <UserPlus size={15} color="#fff" />
            <Text style={styles.inviteBtnText}>Uzaicināt</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {members.length === 0 ? (
            <View style={styles.empty}>
              <Users size={38} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Nav komandas locekļu</Text>
              <Text style={styles.emptyBody}>
                Uzaiciniet kolēģus un iestatiet tiem tiesības — tāpat kā Schüttflix.
              </Text>
              {canManage && (
                <TouchableOpacity
                  style={styles.emptyInviteBtn}
                  onPress={() => {
                    haptics.light();
                    setShowInvite(true);
                  }}
                >
                  <UserPlus size={16} color="#fff" />
                  <Text style={styles.emptyInviteBtnText}>Pievienot pirmo dalībnieku</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                canManage={canManage}
                onEdit={() => {
                  haptics.light();
                  setEditMember(m);
                }}
                onRemove={() => confirmRemove(m)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB — always visible to managers when list has items */}
      {canManage && members.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            haptics.medium();
            setShowInvite(true);
          }}
          activeOpacity={0.85}
        >
          <UserPlus size={20} color="#fff" />
        </TouchableOpacity>
      )}

      <InviteModal
        visible={showInvite}
        token={token ?? ''}
        onClose={() => setShowInvite(false)}
        onInvited={(m) => setMembers((prev) => [...prev, m])}
      />

      <PermissionsSheet
        visible={editMember != null}
        member={editMember}
        token={token ?? ''}
        onClose={() => setEditMember(null)}
        onSaved={(updated) =>
          setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        }
      />
    </ScreenContainer>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  empty: { padding: 40, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyBody: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 19 },
  emptyInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyInviteBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  // card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  memberEmail: { fontSize: 12, color: '#9ca3af' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  permToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  permToggleText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  permChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chipText: { fontSize: 10, fontWeight: '600', color: '#4b5563' },
  permSection: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    gap: 12,
  },
  permLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  permSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  // invite form
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 3 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  saveBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
