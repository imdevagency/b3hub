/**
 * team.tsx — Buyer: Company team members & permissions
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
  Alert,
  FlatList,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  Users,
  UserPlus,
  Trash2,
  Building2,
  Phone,
  Shield,
  FileText,
  Truck,
  ClipboardList,
  Banknote,
  Plus,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiCompanyMember,
  type InviteMemberInput,
  type MemberPermissions,
} from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { useRouter, useNavigation } from 'expo-router';

// ── Types & data ───────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Īpašnieks',
  MANAGER: 'Vadītājs',
  MEMBER: 'Dalībnieks',
  DRIVER: 'Šoferis',
};

const PERM_META: Array<{ key: keyof MemberPermissions; label: string; sub: string }> = [
  { key: 'permCreateContracts', label: 'Projekti', sub: 'Izveidot un pārvaldīt līgumus' },
  { key: 'permReleaseCallOffs', label: 'Pasūtījumu izsaukšana', sub: 'Izsaukt kravas' },
  { key: 'permManageOrders', label: 'Pasūtījumu pārvaldība', sub: 'Apstiprināt un editēt' },
  { key: 'permViewFinancials', label: 'Finanses', sub: 'Rēķini un apgrozījums' },
  { key: 'permManageTeam', label: 'Komandas vadība', sub: 'Pievienot lietotājus' },
];

// ── Styles (Utility Classes) ───────────────────────────────────

const s = {
  // List
  row: 'flex-row items-center py-4 px-6 border-b border-[#f3f4f6] bg-white active:bg-[#f9fafb]',
  headerBtn: 'w-10 h-10 items-center justify-center rounded-full active:bg-gray-100',

  // Avatar
  avatar: 'w-12 h-12 rounded-full bg-[#f3f4f6] items-center justify-center mr-4',
  avatarText: 'text-base font-bold text-[#374151]',

  // Text
  name: 'text-[17px] font-semibold text-[#111827]',
  role: 'text-[14px] text-[#6b7280] mt-0.5',

  // Badges
  badge: 'px-2.5 py-1 rounded-full bg-[#f3f4f6] self-start ml-2',
  badgeText: 'text-[11px] font-bold text-[#374151] uppercase tracking-wide',

  // Sheet
  sheetSection: 'px-6 pt-2 pb-12',
  label: 'text-[13px] font-bold text-[#374151] uppercase tracking-wide mb-2 ml-1',
  input: 'bg-[#f9fafb] rounded-xl px-4 py-3.5 text-[16px] text-[#111827] font-medium mb-4',

  // Toggles
  switchRow: 'flex-row items-center justify-between py-4 border-b border-[#f3f4f6]',
  switchLabel: 'text-[16px] font-medium text-[#111827]',
  switchSub: 'text-[13px] text-[#6b7280] mt-0.5',

  // Actions
  primaryBtn: 'bg-[#111827] rounded-xl py-4 items-center mt-6 shadow-sm active:opacity-90',
  primaryBtnText: 'text-white font-bold text-[16px]',
  deleteBtn:
    'flex-row items-center justify-center gap-2 mt-6 py-4 bg-[#fee2e2] rounded-xl active:opacity-90 border border-red-100',
  deleteBtnText: 'text-[#dc2626] font-bold text-[15px]',
};

// ── Components ─────────────────────────────────────────────────

function MemberRow({ member, onPress }: { member: ApiCompanyMember; onPress: () => void }) {
  const isOwner = member.companyRole === 'OWNER';

  return (
    <TouchableOpacity className={s.row} onPress={onPress} activeOpacity={0.7}>
      <View className={s.avatar}>
        <Text className={s.avatarText}>
          {member.firstName.charAt(0)}
          {member.lastName.charAt(0)}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text className={s.name}>
            {member.firstName} {member.lastName}
          </Text>
          {isOwner && (
            <View className={s.badge}>
              <Text className={s.badgeText}>Owner</Text>
            </View>
          )}
        </View>
        <Text className={s.role} numberOfLines={1}>
          {member.email} • {ROLE_LABEL[member.companyRole ?? 'MEMBER'] ?? member.companyRole}
        </Text>
      </View>

      <ChevronRight size={20} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ── Modals ─────────────────────────────────────────────────────

function MemberDetailsSheet({
  member,
  visible,
  onClose,
  onUpdate,
  onRemove,
  currentUserRole,
}: {
  member: ApiCompanyMember | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, perms: MemberPermissions) => Promise<void>;
  onRemove: (id: string) => void;
  currentUserRole?: string;
}) {
  const [perms, setPerms] = useState<MemberPermissions>({} as any);
  const [loading, setLoading] = useState(false);

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

  if (!member) return null;

  const isOwner = member.companyRole === 'OWNER';
  const isTargetOwner = member.companyRole === 'OWNER';
  const amIOwner = currentUserRole === 'OWNER';
  const canEdit = amIOwner && !isTargetOwner;

  async function handleSave() {
    setLoading(true);
    await onUpdate(member!.id, perms);
    setLoading(false);
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${member.firstName} ${member.lastName}`}
      subtitle={member.email || undefined}
      scrollable
    >
      <View className={s.sheetSection}>
        <View className="mb-8 px-1">
          {/* Phone Row */}
          <View className="flex-row items-center py-4 border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-4">
              <Phone size={18} color="#6b7280" />
            </View>
            <View>
              <Text className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                Telefons
              </Text>
              <Text className="text-[16px] font-semibold text-gray-900 mt-0.5">
                {member.phone || '—'}
              </Text>
            </View>
          </View>

          {/* Role Row */}
          <View className="flex-row items-center py-4 border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-4">
              <Shield size={18} color="#6b7280" />
            </View>
            <View>
              <Text className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                Loma
              </Text>
              <Text className="text-[16px] font-semibold text-gray-900 mt-0.5">
                {ROLE_LABEL[member.companyRole ?? ''] ?? member.companyRole}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-4">
          <Text className={s.label}>Tiesību Pārvaldība</Text>
        </View>

        {PERM_META.map(({ key, label, sub }) => {
          // Icon mapping for permissions to match Uber-style minimalism
          let IconComp = FileText;
          if (key === 'permCreateContracts') IconComp = FileText;
          if (key === 'permReleaseCallOffs') IconComp = Truck;
          if (key === 'permManageOrders') IconComp = ClipboardList;
          if (key === 'permViewFinancials') IconComp = Banknote;
          if (key === 'permManageTeam') IconComp = Users;

          return (
            <View key={key} className="flex-row items-center py-4 border-b border-gray-100">
              <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-4">
                <IconComp size={18} color="#6b7280" />
              </View>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text className="text-[16px] font-medium text-[#111827]">{label}</Text>
                <Text className="text-[13px] text-[#6b7280] mt-0.5">{sub}</Text>
              </View>
              <Switch
                value={perms[key]}
                onValueChange={(v) => {
                  if (canEdit) setPerms((prev) => ({ ...prev, [key]: v }));
                }}
                trackColor={{ false: '#e5e7eb', true: '#111827' }}
                thumbColor="#fff"
                disabled={!canEdit}
              />
            </View>
          );
        })}

        {canEdit && (
          <>
            <TouchableOpacity className={s.primaryBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={s.primaryBtnText}>Saglabāt izmaiņas</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className={s.deleteBtn}
              onPress={() => {
                Alert.alert('Noņemt dalībnieku?', 'Šī darbība ir neatgriezeniska.', [
                  { text: 'Atcelt', style: 'cancel' },
                  { text: 'Noņemt', style: 'destructive', onPress: () => onRemove(member.id) },
                ]);
              }}
            >
              <Trash2 size={18} color="#dc2626" />
              <Text className={s.deleteBtnText}>Noņemt no komandas</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function InviteSheet({
  visible,
  onClose,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onInvite: (data: InviteMemberInput) => Promise<void>;
}) {
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
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    await onInvite(form);
    setLoading(false);
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
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Jauns dalībnieks" scrollable>
      <View className={s.sheetSection}>
        <Text className={s.label}>Pamatinformācija</Text>

        <TextInput
          className={s.input}
          placeholder="Vārds"
          placeholderTextColor="#9ca3af"
          value={form.firstName}
          onChangeText={(t) => setForm((p) => ({ ...p, firstName: t }))}
        />
        <TextInput
          className={s.input}
          placeholder="Uzvārds"
          placeholderTextColor="#9ca3af"
          value={form.lastName}
          onChangeText={(t) => setForm((p) => ({ ...p, lastName: t }))}
        />
        <TextInput
          className={s.input}
          placeholder="E-pasts (ielūgumam)"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(t) => setForm((p) => ({ ...p, email: t }))}
        />
        <TextInput
          className={s.input}
          placeholder="Telefons"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={form.phone || ''}
          onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))}
        />

        <Text className={`${s.label} mt-4`}>Tiesības</Text>
        {PERM_META.map(({ key, label, sub }) => {
          let IconComp = FileText;
          if (key === 'permCreateContracts') IconComp = FileText;
          if (key === 'permReleaseCallOffs') IconComp = Truck;
          if (key === 'permManageOrders') IconComp = ClipboardList;
          if (key === 'permViewFinancials') IconComp = Banknote;
          if (key === 'permManageTeam') IconComp = Users;

          return (
            <View key={key} className="flex-row items-center py-3 border-b border-gray-100">
              <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-4">
                <IconComp size={18} color="#6b7280" />
              </View>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text className="text-[16px] font-medium text-[#111827]">{label}</Text>
                <Text className="text-[12px] text-[#6b7280]">{sub}</Text>
              </View>
              <Switch
                value={form[key] as boolean}
                onValueChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                trackColor={{ false: '#e5e7eb', true: '#111827' }}
                thumbColor="#fff"
              />
            </View>
          );
        })}

        <TouchableOpacity className={s.primaryBtn} onPress={handleSend} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={s.primaryBtnText}>Nosūtīt ielūgumu</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function TeamScreen() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();

  // State
  const [members, setMembers] = useState<ApiCompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sheet State
  const [selectedMember, setSelectedMember] = useState<ApiCompanyMember | null>(null);
  const [isInviteOpen, setInviteOpen] = useState(false);

  // Computed
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
        showToast('Kļūda ielādējot datus', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (user?.isCompany) {
      load();
    }
  }, [user, load]);

  // Actions
  async function handleUpdatePerms(id: string, perms: MemberPermissions) {
    if (!token) return;
    try {
      const updated = await api.companyMembers.updatePermissions(id, perms, token);
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast('Tiesības atjaunotas', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function handleRemove(id: string) {
    if (!token) return;
    try {
      await api.companyMembers.remove(id, token);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setSelectedMember(null);
      showToast('Dalībnieks noņemts', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function handleInvite(data: InviteMemberInput) {
    if (!token) return;
    if (!data.email || !data.firstName || !data.lastName) {
      showToast('Lūdzu aizpildiet obligātos laukus', 'error');
      return;
    }
    try {
      const res = await api.companyMembers.invite(data, token);
      setMembers((prev) => [...prev, res.member]);
      showToast('Ielūgums nosūtīts', 'success');
      setInviteOpen(false);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  // Guard: Not a company
  if (!user?.isCompany) {
    return (
      <ScreenContainer bg="white">
        <ScreenHeader title="Komanda" />
        <EmptyState
          icon={<Building2 size={42} color="#9ca3af" />}
          title="Tikai uzņēmumiem"
          subtitle="Komandas pārvaldība ir pieejama tikai juridiskām personām. Sazinieties ar atbalstu lai mainītu konta tipu."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="white">
      {/* Header */}
      <ScreenHeader
        title="Komanda"
        rightAction={
          canManage && (
            <TouchableOpacity
              className={s.headerBtn}
              onPress={() => {
                haptics.light();
                setInviteOpen(true);
              }}
            >
              <Plus size={24} color="#111827" strokeWidth={2.5} />
            </TouchableOpacity>
          )
        }
      />

      {/* List */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
            />
          }
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              onPress={() => {
                haptics.light();
                setSelectedMember(item);
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Users size={42} color="#9ca3af" />}
              title="Nav dalībnieku"
              subtitle="Pievienojiet kolēģus, lai kopīgi pārvaldītu pasūtījumus un objektus."
              action={
                canManage ? (
                  <TouchableOpacity
                    className={s.primaryBtn}
                    style={{ marginTop: 20, width: 220 }}
                    onPress={() => setInviteOpen(true)}
                  >
                    <Text className={s.primaryBtnText}>Pievienot kolēģi</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          }
        />
      )}

      {/* Sheets */}
      <MemberDetailsSheet
        visible={!!selectedMember}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onUpdate={handleUpdatePerms}
        onRemove={handleRemove}
        currentUserRole={user?.companyRole ?? undefined}
      />

      <InviteSheet
        visible={isInviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />
    </ScreenContainer>
  );
}
