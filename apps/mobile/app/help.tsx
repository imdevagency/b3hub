import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, MessageCircle, Mail } from 'lucide-react-native';
import { Linking } from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── FAQ data ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'Pasūtījumi',
    items: [
      {
        q: 'Kā veikt materiālu pasūtījumu?',
        a: 'Izvēlieties "Materiāli" sākumlapā, norādiet preci, daudzumu un piegādes adresi. Pēc apstiprināšanas piegādātājs sazināsies ar Jums.',
      },
      {
        q: 'Kā iznomāt atkritumu konteineru?',
        a: 'Atveriet "Konteineri", izvēlieties izmēru un atkritumu veidu, norādiet adresi un piegādes datumu. Konteiners tiks piegādāts norādītajā laikā.',
      },
      {
        q: 'Kā pasūtīt celtniecības atkritumu izvešanu?',
        a: 'Izmantojiet pakalpojumu "Atkritumi". Norādiet adresi, atkritumu veidu un apjomu. Sistēma automātiski atlasīs piemērotu pārvadātāju.',
      },
      {
        q: 'Kā pasūtīt kravu pārvadāšanu no A uz B?',
        a: 'Atveriet "Transports A→B", ievadiet iekraušanas un piegādes adreses, kravas aprakstu un vēlamo datumu.',
      },
    ],
  },
  {
    title: 'Pasūtījumu statusi',
    items: [
      {
        q: 'Ko nozīmē statuss "Gaida"?',
        a: 'Pasūtījums ir saņemts un gaida, kad pārvadātājs to pieņems. Parasti tas notiek dažu stundu laikā.',
      },
      {
        q: 'Ko nozīmē statuss "Apstiprināts"?',
        a: 'Pārvadātājs ir pieņēmis Jūsu pasūtījumu un plāno to izpildīt norādītajā datumā.',
      },
      {
        q: 'Vai es varu atcelt pasūtījumu?',
        a: 'Jā — pasūtājumus ar statusu "Gaida" vai "Apstiprināts" var atcelt, atverot pasūtājuma detaļas un nospiežot "Atcelt pasūtījumu".',
      },
    ],
  },
  {
    title: 'Konts un profils',
    items: [
      {
        q: 'Kā pievienot telefona numuru?',
        a: 'Dodieties uz sadaļu "Profils", spiediet "Rediģēt profilu" un ievadiet telefona numuru. Tas ļaus pārvadātājiem ar Jums sazināties.',
      },
      {
        q: 'Kā kļūt par piegādātāju vai pārvadātāju?',
        a: 'Apmeklējiet b3hub.lv/apply un aizpildiet pieteikuma formu. Mēs izskatīsim pieteikumu un sazināsimies ar Jums pa e-pastu.',
      },
      {
        q: 'Kā mainīt paroli?',
        a: 'Saistībā ar drošību paroli var mainīt, izmantojot ekrānu "Mainīt paroli" (pieejams no konta iestatījumiem) vai arī piesakieties no jauna ar "Aizmirsu paroli".',
      },
    ],
  },
  {
    title: 'Citi jautājumi',
    items: [
      {
        q: 'Kā es saņemšu paziņojumus par pasūtījumu statusu?',
        a: 'Paziņojumi tiek sūtīti automātiski, kad mainās pasūtījuma statuss. Tos skatiet sadaļā "Paziņojumi" vai zvans/e-pasts no pārvadātāja.',
      },
      {
        q: 'Kādās valūtās darbojas B3Hub?',
        a: 'Visi maksājumi tiek apstrādāti eiro (EUR).',
      },
      {
        q: 'Ko darīt, ja radusies problēma ar pasūtījumu?',
        a: 'Sazinieties ar mums, izmantojot zemāk esošo pogu "Rakstīt mums". Mēs atbildēsim 1 darba dienas laikā.',
      },
    ],
  },
];

// ── Accordion item ────────────────────────────────────────────────────────────

function FaqItem({ q, a, isLast }: { q: string; a: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen((v) => !v);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={[s.faqItem, !isLast && s.faqItemBorder]}>
      <TouchableOpacity style={s.faqQuestion} onPress={toggle} activeOpacity={0.75}>
        <Text style={s.faqQ}>{q}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={16} color="#6b7280" />
        </Animated.View>
      </TouchableOpacity>
      {open && <Text style={s.faqA}>{a}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();

  return (
    <ScreenContainer standalone bg="#f9fafb">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Biežāk uzdotie jautājumi</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Šeit atradīsiet atbildes uz visbiežāk uzdotajiem jautājumiem par B3Hub platformas
          lietošanu.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.card}>
              {section.items.map((item, idx) => (
                <FaqItem
                  key={idx}
                  q={item.q}
                  a={item.a}
                  isLast={idx === section.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Contact CTA */}
        <View style={s.contactCard}>
          <Text style={s.contactTitle}>Neatradāt atbildi?</Text>
          <Text style={s.contactSub}>Sazinieties ar mums — atbildēsim ātri.</Text>
          <View style={s.contactBtns}>
            <TouchableOpacity
              style={s.contactBtn}
              onPress={() => Linking.openURL('mailto:info@b3hub.lv')}
              activeOpacity={0.8}
            >
              <Mail size={15} color="#fff" />
              <Text style={s.contactBtnText}>E-pasts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.contactBtn, s.contactBtnSecondary]}
              onPress={() => Linking.openURL('https://b3hub.lv/kontakti')}
              activeOpacity={0.8}
            >
              <MessageCircle size={15} color="#111827" />
              <Text style={[s.contactBtnText, { color: '#111827' }]}>Rakstīt mums</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  scroll: { padding: 20 },
  intro: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  faqQuestion: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  faqA: {
    marginTop: 10,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 21,
    paddingRight: 28,
  },

  contactCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    marginTop: 4,
  },
  contactTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 6 },
  contactSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  contactBtns: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 13,
  },
  contactBtnSecondary: { backgroundColor: '#fff' },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
