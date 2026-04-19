  const renderOffers = () => {
    // ── Success: order placed ──
    if (submitted === 'order') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={s.successIconBg}>
              <CheckCircle2 size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pasūtījums veikts!</Text>
            <Text style={s.successNum}>Nr. {orderNumber}</Text>
          </View>
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <MapPin size={16} color="#111827" />
              <Text style={s.summaryText} numberOfLines={2}>
                {pickedAddress?.address}
              </Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <Truck size={16} color="#111827" />
              <Text style={s.summaryText}>
                {quantity} {UNIT_SHORT[unit]} · {materialName}
                {truckCount > 1 ? ` · ${truckCount} auto (ik ${truckIntervalMinutes} min)` : ''}
              </Text>
            </View>
            {deliveryDate ? (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Calendar size={16} color="#111827" />
                  <Text style={s.summaryText}>
                    {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      );
    }

    // ── Success: RFQ sent ──
    if (submitted === 'rfq') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={[s.successIconBg, { backgroundColor: '#2563eb' }]}>
              <Send size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
            <Text style={s.successNum}>Nr. {rfqNumber}</Text>
            <Text style={s.successSub}>
              Piegādātāji jūsu rajonā saņēma paziņojumu. Kad kāds atbildēs ar cenu, jūs saņemsiet
              paziņojumu.
            </Text>
          </View>
        </ScrollView>
      );
    }

    // ── Loading ──
    if (offersLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>
            Meklējam pieejamos piegādātājus...
          </Text>
        </View>
      );
    }

    // ── Error or no offers ──
    if (offersError || offers.length === 0) {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          {offersError ? (
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{offersError}</Text>
          ) : (
            <>
              <Text style={s.offersTitle}>Nav tūlītēju piedāvājumu</Text>
              <Text style={s.offersSub}>
                Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
              </Text>
            </>
          )}
          {submitError ? (
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
          ) : null}
          <View style={s.rfqBox}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={s.rfqIconBg}>
                <Send size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rfqTitle}>Nosūtīt cenu pieprasījumu</Text>
                <Text style={s.rfqSub}>
                  Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    // ── Offers list ──
    const sorted = [...offers]
      .filter((o) => priceMaxFilter == null || o.effectiveUnitPrice <= priceMaxFilter)
      .sort((a, b) => {
        if (offersSort === 'distance') {
          const da = a.distanceKm ?? Infinity;
          const db = b.distanceKm ?? Infinity;
          return da - db;
        }
        if (offersSort === 'eta') {
          const ea = a.etaHours ?? a.etaDays * 8;
          const eb = b.etaHours ?? b.etaDays * 8;
          return ea - eb;
        }
        if (offersSort === 'rating') {
          const ra = a.supplier.rating ?? 0;
          const rb = b.supplier.rating ?? 0;
          return rb - ra;
        }
        return a.totalPrice - b.totalPrice; // default: price
      });

    const SORT_OPTIONS: { key: typeof offersSort; label: string }[] = [
      { key: 'price', label: 'Cena' },
      { key: 'distance', label: 'Attālums' },
      { key: 'eta', label: 'Piegādes laiks' },
      { key: 'rating', label: 'Vērtējums' },
    ];

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Text style={s.offersTitle}>
          {sorted.length}
          {sorted.length < offers.length ? `/${offers.length}` : ''} piedāvājum
          {sorted.length === 1 ? 's' : 'i'}
        </Text>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  haptics.light();
                  setOffersSort(opt.key);
                }}
                style={[s.sortPill, offersSort === opt.key && s.sortPillActive]}
              >
                <Text style={[s.sortPillText, offersSort === opt.key && s.sortPillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Price cap filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginRight: 2 }}>Max €/t:</Text>
            {[null, 10, 20, 30, 50, 100].map((cap) => (
              <TouchableOpacity
                key={cap === null ? 'all' : cap}
                onPress={() => {
                  haptics.light();
                  setPriceMaxFilter(cap);
                }}
                style={[s.sortPill, priceMaxFilter === cap && s.sortPillActive]}
              >
                <Text style={[s.sortPillText, priceMaxFilter === cap && s.sortPillTextActive]}>
                  {cap === null ? 'Visi' : `≤€${cap}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {submitError ? (
          <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
        ) : null}
        {sorted.map((offer, idx) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            unit={unit}
            isCheapest={offersSort === 'price' && idx === 0}
            submitting={submitting}
            onSelect={() => handleSelectOffer(offer)}
          />
        ))}
        {/* RFQ fallback — always visible below offers */}
        <View style={[s.rfqBox, { marginTop: 4 }]}>
          <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Vēlaties saņemt vairāk piedāvājumu?
          </Text>
          <TouchableOpacity
            style={[s.rfqBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSendRFQ}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Send size={14} color="#111827" />
            <Text style={s.rfqBtnText}>Pieprasīt vairāk piedāvājumu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  if (step === 'address') {
    return (
      <InlineAddressStep
        picked={pickedAddress}
        onPick={(p) => setPickedAddress(p)}
        onConfirm={goNext}
        onCancel={goBack}
        initialText={params.prefillAddress}
        contextLabel="Izkraušanas vieta"
        pricePreviewCategory={selectedCategory}
        pricePreviewQuantity={quantity}
      />
    );
  }

  return (
