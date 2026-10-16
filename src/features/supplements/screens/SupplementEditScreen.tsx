import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Field, stockStore, useStock } from '@/features/shop';
import { useRepositories } from '@/lib/db';
import { Button, Card, Chip, Segmented, SectionLabel, Screen, Text, useTheme } from '@/ui';

import { DISCLAIMER } from '../copy';
import { emptyForm, validateSupplementForm, type SupplementFormField, type SupplementFormValues } from '../logic/form';
import { inferTrainingDays, maskHas, WEEKDAY_LONG, WEEKDAY_SHORT, type ScheduleMode } from '../logic/schedule';
import { afterSupplementWrite } from '../services/reminders';
import { useSupplementRepository } from '../services/store';

const MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: 'fixed', label: 'Vaste dagen' },
  { value: 'training', label: 'Trainingsdagen' },
  { value: 'rest', label: 'Rustdagen' },
];

/** "+ Supplement toevoegen" / edit. The user types the dose, days and time; the app suggests none. */
export function SupplementEditScreen() {
  const { space } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const repo = useSupplementRepository();
  const repos = useRepositories();
  const { items: stockItems } = useStock();
  const [form, setForm] = useState<SupplementFormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SupplementFormField, string>>>({});
  const [busy, setBusy] = useState(false);
  const isNew = !id;

  useEffect(() => {
    void stockStore.load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await repo.getSetting<number>('supplements.trainingDays');
      let trainingMask = stored;
      if (trainingMask === null) {
        const history = await repos.workouts.history({ limit: 40 }).catch(() => []);
        trainingMask = inferTrainingDays(
          history.map((w) => w.started_at),
          new Date(),
        );
      }
      const base = emptyForm(trainingMask);
      if (id) {
        const s = await repo.get(id);
        const sc = s?.schedules[0];
        if (s) {
          base.id = s.id;
          base.name = s.name;
          base.doseText = s.dose_text;
          base.variantGid = s.shopify_variant_gid;
          base.unitsPerPack = s.units_per_pack === null ? '' : String(s.units_per_pack);
          base.unitsLeft = s.units_left === null ? '' : String(s.units_left);
          if (sc) {
            base.mode = sc.mode;
            base.time = sc.time_local;
            if (sc.mode === 'fixed') base.fixedDaysMask = sc.days_mask;
          }
        }
      }
      if (!cancelled) setForm(base);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, repo, repos]);

  if (!form) return <Screen title={isNew ? 'Supplement toevoegen' : 'Supplement'} onBack={() => router.back()} />;

  const set = (patch: Partial<SupplementFormValues>) => setForm({ ...form, ...patch });
  const daysMask = form.mode === 'fixed' ? form.fixedDaysMask : form.trainingDaysMask;
  const toggleDay = (d: number) => {
    const next = daysMask ^ (1 << d);
    set(form.mode === 'fixed' ? { fixedDaysMask: next } : { trainingDaysMask: next });
  };
  const linkable = stockItems.filter((i) => i.variantId);
  const linkedTitle = linkable.find((i) => i.variantId === form.variantGid)?.productTitle;

  async function save() {
    if (!form) return;
    const res = validateSupplementForm(form, { isNew });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await repo.save(res.input);
      if (form.mode !== 'fixed') {
        await repo.setSetting('supplements.trainingDays', res.trainingDaysMask);
        await repo.applyTrainingDays(res.trainingDaysMask);
      }
      await afterSupplementWrite(repo);
      router.back();
    } catch {
      Alert.alert('Opslaan lukte niet', 'Probeer het nog een keer.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!form?.id) return;
    const sid = form.id;
    Alert.alert('Supplement verwijderen?', 'Het schema en de herinneringen voor dit supplement verdwijnen.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await repo.softDelete(sid);
            await afterSupplementWrite(repo);
            router.back();
          })(),
      },
    ]);
  }

  return (
    <Screen
      title={isNew ? 'Supplement toevoegen' : 'Supplement'}
      onBack={() => router.back()}
      footer={<Button label="Opslaan" size="lg" fullWidth loading={busy} onPress={() => void save()} />}
    >
      <Field label="Naam" value={form.name} onChangeText={(name) => set({ name })} error={errors.name} autoCapitalize="sentences" maxLength={60} />
      <Field
        label="Hoeveelheid (zoals jij het neemt)"
        value={form.doseText}
        onChangeText={(doseText) => set({ doseText })}
        error={errors.doseText}
        hint="Vrije tekst, alleen voor jezelf. Volg het etiket."
        maxLength={40}
      />

      <View style={{ gap: space.sm }}>
        <SectionLabel label="Wanneer" />
        <Segmented options={MODE_OPTIONS} value={form.mode} onChange={(mode) => set({ mode })} accessibilityLabel="Schema" />
        <Text variant="caption" tone="tertiary">
          {form.mode === 'fixed' ? 'Kies de dagen.' : 'Kies je trainingsdagen. Dit geldt voor al je supplementen op trainings- of rustdagen.'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {WEEKDAY_SHORT.map((label, d) => (
            <Chip
              key={label}
              label={label.charAt(0) + label.slice(1).toLowerCase()}
              selected={maskHas(daysMask, d)}
              onPress={() => toggleDay(d)}
              testID={`day-${WEEKDAY_LONG[d]}`}
            />
          ))}
        </ScrollView>
        {errors.days ? (
          <Text variant="caption" tone="danger">
            {errors.days}
          </Text>
        ) : null}
        <Field
          label="Tijd"
          value={form.time}
          onChangeText={(time) => set({ time })}
          error={errors.time}
          placeholder="uu:mm"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <SectionLabel label="Voorraad (optioneel)" />
        <Field
          label="Porties per verpakking"
          value={form.unitsPerPack}
          onChangeText={(unitsPerPack) => set({ unitsPerPack })}
          error={errors.unitsPerPack}
          keyboardType="number-pad"
          hint="Staat op het etiket. Eén keer afvinken telt als één portie."
        />
        <Field
          label="Porties over"
          value={form.unitsLeft}
          onChangeText={(unitsLeft) => set({ unitsLeft })}
          error={errors.unitsLeft}
          keyboardType="number-pad"
          hint={isNew ? 'Leeg = een volle verpakking.' : undefined}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <SectionLabel label="Supp City-product (optioneel)" />
        {linkable.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Koppelen kan met producten uit je voorraadteller in de shop. Je kunt dit later doen.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="Niet gekoppeld" selected={form.variantGid === null} onPress={() => set({ variantGid: null })} />
            {linkable.map((i) => (
              <Chip key={i.id} label={i.productTitle} selected={form.variantGid === i.variantId} onPress={() => set({ variantGid: i.variantId })} />
            ))}
          </ScrollView>
        )}
        {form.variantGid && !linkedTitle ? (
          <Text variant="caption" tone="tertiary">
            Gekoppeld aan een Supp City-product.
          </Text>
        ) : null}
      </View>

      <Card variant="inset">
        <Text variant="caption" tone="secondary">
          {DISCLAIMER}
        </Text>
      </Card>

      {!isNew ? <Button label="Supplement verwijderen" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
