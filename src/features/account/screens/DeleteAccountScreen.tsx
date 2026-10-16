import { router } from 'expo-router';
import { useState } from 'react';

import { Field, Notice, SubScreen } from '@/features/shop';
import { Button, Card, EmptyState, Text } from '@/ui';

import { deleteAccount } from '../services/session';

const CONFIRM_WORD = 'VERWIJDER';

/** Hard rule 3: delete the account in the app, with an explicit confirmation. */
export function DeleteAccountScreen() {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <SubScreen title="Account verwijderd" fallback="/ik">
        <EmptyState
          icon="check"
          title="Je account is verwijderd"
          body="Je app-account en al je trainingsgegevens zijn verwijderd."
          action={{ label: 'Sluiten', onPress: () => router.replace('/ik') }}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title="Account verwijderen"
      fallback="/ik"
      footer={
        <>
          {error ? <Notice message={error} tone="danger" onDismiss={() => setError(null)} /> : null}
          <Button
            label="Definitief verwijderen"
            variant="danger"
            size="lg"
            fullWidth
            loading={busy}
            disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD}
            onPress={async () => {
              setBusy(true);
              const res = await deleteAccount();
              setBusy(false);
              if (res.ok) setDone(true);
              else setError(res.message);
            }}
          />
        </>
      }
    >
      <Card eyebrow="Dit wordt verwijderd">
        <Text tone="secondary">Je app-account, trainingen, sets, schema&apos;s, toestemmingen, punten en voorraadteller. Dit kan niet ongedaan worden gemaakt.</Text>
      </Card>
      <Card eyebrow="Dit blijft bewaard">
        <Text tone="secondary">
          Je bestellingen en facturen blijven bij onze webshop (Shopify) bewaard, omdat we die wettelijk 7 jaar moeten
          bewaren voor de belastingdienst. Wil je ook je webshop-account laten verwijderen? Mail info@suppcity.nl.
        </Text>
      </Card>
      <Field
        label={`Typ ${CONFIRM_WORD} om te bevestigen`}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </SubScreen>
  );
}
