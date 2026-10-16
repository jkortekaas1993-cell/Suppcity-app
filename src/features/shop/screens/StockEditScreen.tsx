import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, SectionLabel, Text, useTheme } from '@/ui';

import { OptionChip } from '../components/OptionChip';
import { Field } from '../components/Field';
import { SubScreen } from '../components/SubScreen';
import {
  estimateStock,
  localIsoDate,
  parseDecimal,
  STOCK_ERROR_NL,
  STOCK_UNITS,
  validateStockInput,
  type StockUnit,
  type StockValidationError,
} from '../logic/stock';
import { stockStore } from '../state/stockStore';

const UNIT_LABEL: Record<StockUnit, string> = { g: 'gram', ml: 'ml', stuks: 'stuks' };
const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Dosage settings for one product. Only product facts the user enters themselves
 * (hard rule 1): no training or body data is read or suggested here.
 */
export function StockEditScreen() {
  const params = useLocalSearchParams<{ id?: string; title?: string; variantId?: string }>();
  const { space } = useTheme();
  const existing = params.id ? stockStore.get(String(params.id)) : undefined;
  const today = localIsoDate(new Date());

  const [title, setTitle] = useState(existing?.productTitle ?? (params.title ? String(params.title) : ''));
  const [unit, setUnit] = useState<StockUnit>(existing?.unit ?? 'g');
  const [packageAmount, setPackageAmount] = useState(existing ? fmt(existing.packageAmount) : '');
  const [servingAmount, setServingAmount] = useState(existing ? fmt(existing.servingAmount) : '');
  const [servingsPerDay, setServingsPerDay] = useState(existing ? fmt(existing.servingsPerDay) : '1');
  const [packages, setPackages] = useState(existing ? String(existing.packages) : '1');
  const [startedOn, setStartedOn] = useState(existing?.startedOn ?? today);
  const [remind, setRemind] = useState(existing ? String(existing.remindDaysBefore) : '7');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    void stockStore.load();
  }, []);

  const input = {
    packageAmount: parseDecimal(packageAmount),
    servingAmount: parseDecimal(servingAmount),
    unit,
    servingsPerDay: parseDecimal(servingsPerDay),
    packages: Number(packages),
    startedOn: startedOn.trim(),
    remindDaysBefore: Number(remind),
  };
  const errors = validateStockInput(input);
  const titleError = title.trim().length === 0 ? 'Geef het product een naam.' : null;
  const err = (e: StockValidationError) => (submitted && errors.includes(e) ? STOCK_ERROR_NL[e] : null);

  const preview = useMemo(
    () =>
      errors.length === 0
        ? estimateStock({ ...input, id: 'preview', productTitle: title, variantId: null }, today)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packageAmount, servingAmount, servingsPerDay, packages, startedOn, remind, unit, title, today],
  );

  async function save() {
    setSubmitted(true);
    if (errors.length > 0 || titleError) return;
    await stockStore.upsert({
      ...input,
      id: existing?.id,
      productTitle: title.trim(),
      variantId: existing?.variantId ?? (params.variantId ? String(params.variantId) : null),
    });
    router.back();
  }

  return (
    <SubScreen
      title={existing ? 'Voorraad aanpassen' : 'Product toevoegen'}
      footer={
        <>
          {preview ? (
            <Text variant="caption" tone="secondary" tnum>
              {preview.servingsTotal} porties · nog ~{preview.daysLeft} dagen
            </Text>
          ) : null}
          <Button label="Opslaan" size="lg" fullWidth onPress={save} />
        </>
      }
    >
      <Field label="Product" value={title} onChangeText={setTitle} placeholder="Bijv. Creatine monohydraat" error={submitted ? titleError : null} />
      <View style={{ gap: space.sm }}>
        <SectionLabel label="Eenheid" />
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
          {STOCK_UNITS.map((u) => (
            <OptionChip key={u} label={UNIT_LABEL[u]} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </View>
      <Field
        label="Inhoud per verpakking"
        keyboardType="decimal-pad"
        suffix={unit}
        value={packageAmount}
        onChangeText={setPackageAmount}
        placeholder="500"
        error={err('package_amount')}
      />
      <Field
        label="Portiegrootte"
        keyboardType="decimal-pad"
        suffix={unit}
        value={servingAmount}
        onChangeText={setServingAmount}
        placeholder="5"
        hint="Staat op het etiket."
        error={err('serving_amount') ?? err('serving_larger_than_package')}
      />
      <Field
        label="Porties per dag"
        keyboardType="decimal-pad"
        value={servingsPerDay}
        onChangeText={setServingsPerDay}
        error={err('servings_per_day')}
      />
      <Field label="Aantal verpakkingen" keyboardType="number-pad" value={packages} onChangeText={setPackages} error={err('packages')} />
      <Field
        label="Begonnen op"
        value={startedOn}
        onChangeText={setStartedOn}
        placeholder="jjjj-mm-dd"
        autoCapitalize="none"
        error={err('started_on')}
      />
      <Field
        label="Herinner me"
        keyboardType="number-pad"
        suffix="dagen vooraf"
        value={remind}
        onChangeText={setRemind}
        error={err('remind_days')}
      />
      {existing ? (
        <View style={{ gap: space.sm }}>
          <Button
            label="Nieuwe verpakking geopend"
            variant="secondary"
            onPress={async () => {
              await stockStore.restart(existing.id, today);
              router.back();
            }}
          />
          <Button
            label="Verwijderen"
            variant="danger"
            onPress={async () => {
              await stockStore.remove(existing.id);
              router.back();
            }}
          />
        </View>
      ) : null}
    </SubScreen>
  );
}
