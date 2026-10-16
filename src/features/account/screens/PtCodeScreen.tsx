import { router } from 'expo-router';
import { useState } from 'react';

import { Field, Notice, SubScreen, useAsync } from '@/features/shop';
import { Button, Text } from '@/ui';

import { normalisePtCode } from '@/lib/supabase/ptCode';
import { getAccountServices } from '../services/registry';

export function PtCodeScreen() {
  const service = getAccountServices().ptCode;
  const current = useAsync(async () => (service ? service.current() : null), [service]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    const normalised = normalisePtCode(code);
    if (!normalised) {
      setError('Een PT-code bestaat uit 4 tot 12 letters of cijfers.');
      return;
    }
    if (!service) return;
    setBusy(true);
    const res = await service.link(normalised);
    setBusy(false);
    if (res.ok) router.back();
    else setError(res.reason === 'invalid' ? 'Deze code kennen we niet. Check hem bij je trainer.' : 'Koppelen lukte niet. Probeer het later opnieuw.');
  }

  return (
    <SubScreen
      title="PT-code"
      subtitle="Train je met een personal trainer van Supp City? Vul zijn of haar code in. Delen van je trainingen zet je apart aan bij Toestemmingen."
      fallback="/ik"
      footer={<Button label="Koppelen" size="lg" fullWidth loading={busy} disabled={!service} onPress={link} />}
    >
      {!service ? <Text tone="secondary">PT-codes koppelen is binnenkort beschikbaar.</Text> : null}
      {current.data ? (
        <Notice
          message={`Gekoppeld aan ${current.data}.`}
          action={{
            label: 'Ontkoppelen',
            onPress: async () => {
              await service?.unlink();
              current.reload();
            },
          }}
        />
      ) : null}
      <Field
        label="Code"
        value={code}
        onChangeText={(t) => {
          setCode(t);
          setError(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Bijv. PT1234"
        error={error}
      />
    </SubScreen>
  );
}
