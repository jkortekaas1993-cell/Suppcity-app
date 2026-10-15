import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { LoadState, Notice, SubScreen } from '@/features/shop';
import { FEATURES, POLICY_VERSION } from '@/lib/config';
import { useCustomerSession } from '@/lib/shopify';
import type { ConsentState, ConsentType } from '@/lib/supabase';
import { Card, Text, useTheme } from '@/ui';

import { applyConsent, CONSENT_COPY, visibleConsents } from '../consentCopy';
import { getAccountServices } from '../services/registry';

/**
 * One switch per consent (hard rule 2): separate, withdrawable, every change is
 * logged server-side with a timestamp by the ConsentService (append-only).
 */
export function PrivacyScreen() {
  const { colors, space } = useTheme();
  const signedIn = useCustomerSession() === 'signedIn';
  const service = getAccountServices().consents;
  const [states, setStates] = useState<ConsentState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ConsentType | null>(null);

  useEffect(() => {
    if (!service || !signedIn) {
      setLoading(false);
      return;
    }
    service
      .list()
      .then(setStates)
      .catch(() => setError('Je toestemmingen konden niet worden geladen.'))
      .finally(() => setLoading(false));
  }, [service, signedIn]);

  async function toggle(type: ConsentType, granted: boolean) {
    if (!service) return;
    const previous = states;
    setStates(applyConsent(states, type, granted, new Date().toISOString(), POLICY_VERSION));
    setPending(type);
    try {
      // Append-only event with server timestamp + policy version (hard rule 2).
      const saved = granted ? await service.grant(type, POLICY_VERSION) : await service.revoke(type, POLICY_VERSION);
      setStates((s) => s.map((x) => (x.type === type ? saved : x)));
    } catch {
      setStates(previous);
      setError('Opslaan lukte niet. Je keuze is niet gewijzigd.');
    } finally {
      setPending(null);
    }
  }

  const unavailable = !signedIn || !service;

  return (
    <SubScreen
      title="Toestemmingen"
      subtitle="Elke keuze staat los van de andere en kun je altijd weer uitzetten. Je trainings- en lichaamsgegevens gebruiken we nooit voor marketing of punten."
    >
      <LoadState loading={loading} error={null} />
      {error ? <Notice message={error} tone="danger" onDismiss={() => setError(null)} /> : null}
      {unavailable && !loading ? (
        <Text tone="muted">
          {signedIn ? 'Toestemmingen beheren is binnenkort beschikbaar.' : 'Log in om je toestemmingen te beheren. Zonder account staat alles uit.'}
        </Text>
      ) : null}
      <Card style={{ padding: 0 }}>
        {visibleConsents(FEATURES).map((type) => {
          const state = states.find((s) => s.type === type);
          const copy = CONSENT_COPY[type];
          return (
            <View
              key={type}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: space.xxs }}>
                <Text variant="heading">{copy.title}</Text>
                <Text variant="caption" tone="muted">
                  {copy.body}
                </Text>
                {state?.changedAt ? (
                  <Text variant="caption" tone="muted">
                    Laatst gewijzigd {new Date(state.changedAt).toLocaleDateString('nl-NL')}
                  </Text>
                ) : null}
              </View>
              <Switch
                accessibilityLabel={copy.title}
                value={state?.granted ?? false}
                disabled={unavailable || pending !== null}
                onValueChange={(v) => void toggle(type, v)}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          );
        })}
      </Card>
    </SubScreen>
  );
}
