import { useState } from 'react';
import { Switch, View } from 'react-native';

import { useRepositories } from '@/lib/db';
import { Button, Card, Text, useTheme } from '@/ui';

import { DEFAULT_CHOICES, type NotificationChoices, type NotificationPrefs } from '../logic/notificationPrefs';
import { declineNotifications, saveChoicesAndAsk } from '../notifications';

const OPTIONS: { key: keyof NotificationChoices; title: string; body: string }[] = [
  { key: 'restTimer', title: 'Rusttimer', body: 'Een seintje als je rust voorbij is, ook als je telefoon op slot staat.' },
  { key: 'orderStatus', title: 'Bestelstatus', body: 'Wanneer je bestelling onderweg of bezorgd is.' },
  { key: 'restock', title: 'Aanvullen', body: 'Een herinnering voordat je pot leeg is.' },
  { key: 'promotions', title: 'Acties', body: 'Maximaal één keer per week. Nooit op basis van je trainingen.' },
];

/**
 * Shown once, in the summary after the first finished workout (ADR-9, C3). Explains
 * each kind of notification separately; only "Opslaan" asks the OS for permission.
 */
export function NotificationOptInCard({ onDone }: { onDone: (prefs: NotificationPrefs) => void }) {
  const repos = useRepositories();
  const { colors, space } = useTheme();
  const [choices, setChoices] = useState<NotificationChoices>({ ...DEFAULT_CHOICES });
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<NotificationPrefs>) {
    setBusy(true);
    try {
      onDone(await fn());
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card eyebrow="Meldingen">
      <Text tone="secondary">Wil je meldingen? Kies zelf welke. Je kunt dit later altijd aanpassen in de instellingen van je telefoon.</Text>
      {OPTIONS.map((o) => (
        <View key={o.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}>
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text variant="bodyStrong">{o.title}</Text>
            <Text variant="caption" tone="tertiary">
              {o.body}
            </Text>
          </View>
          <Switch
            accessibilityLabel={o.title}
            value={choices[o.key]}
            disabled={busy}
            onValueChange={(v) => setChoices((c) => ({ ...c, [o.key]: v }))}
            trackColor={{ true: colors.accent, false: colors.bg3 }}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button variant="ghost" label="Niet nu" disabled={busy} onPress={() => void run(() => declineNotifications(repos.appState))} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            label="Opslaan"
            loading={busy}
            onPress={() => void run(() => saveChoicesAndAsk(repos.appState, choices))}
          />
        </View>
      </View>
    </Card>
  );
}
