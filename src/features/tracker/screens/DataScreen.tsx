import { useState } from 'react';
import { Share } from 'react-native';

import { newId, useRepositories } from '@/lib/db';
import { Button, Card, Text } from '@/ui';

import { TextField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { CsvImportError } from '../logic/csvImport';
import { exportAllCsv, importWorkoutCsv, type ImportSummary } from '../services/dataPort';

/**
 * CSV export of all own training data (hard rule 9) and Hevy/Strong import.
 *
 * MVP without extra native deps: export goes through the OS share sheet as
 * text; import takes pasted CSV text. A file picker (expo-document-picker)
 * and file export (expo-file-system + expo-sharing) can replace both once
 * those packages are added to package.json.
 */
export function DataScreen() {
  const repos = useRepositories();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      const out = await exportAllCsv(repos);
      await Share.share({ title: 'suppcity-trainingen.csv', message: out.csv });
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    setError(null);
    setResult(null);
    try {
      setResult(await importWorkoutCsv(repos, csv, newId));
      setCsv('');
    } catch (err) {
      setError(err instanceof CsvImportError ? err.message : 'Importeren is mislukt. Controleer het bestand.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <StackScreen title="Data">
      <Card eyebrow="Exporteren">
        <Text>Al je trainingen en sets als CSV. Kolommen zijn gelijk aan een Hevy-export.</Text>
        <Button label="Exporteer als CSV" loading={busy === 'export'} onPress={() => void doExport()} />
      </Card>

      <Card eyebrow="Importeren uit Hevy of Strong">
        <Text tone="muted">
          Exporteer je data in Hevy (Profiel → Instellingen → Data exporteren) of Strong (Instellingen → Exporteer
          data) en plak de inhoud van het CSV-bestand hieronder. Onbekende oefeningen worden als eigen oefening
          aangemaakt. Al geïmporteerde trainingen worden overgeslagen.
        </Text>
        <TextField
          value={csv}
          onChangeText={setCsv}
          multiline
          placeholder="Plak hier je CSV"
          accessibilityLabel="CSV-inhoud"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 12, fontSize: 13 }}
        />
        <Button label="Importeren" variant="secondary" disabled={!csv.trim()} loading={busy === 'import'} onPress={() => void doImport()} />
        {error ? <Text tone="danger">{error}</Text> : null}
        {result ? (
          <>
            <Text>
              {result.imported} training{result.imported === 1 ? '' : 'en'} geïmporteerd uit {result.format === 'hevy' ? 'Hevy' : 'Strong'}
              {result.skipped > 0 ? `, ${result.skipped} al aanwezig` : ''}.
            </Text>
            {result.createdExercises.length > 0 ? (
              <Text tone="muted">Nieuwe eigen oefeningen: {result.createdExercises.join(', ')}</Text>
            ) : null}
            {result.warnings.slice(0, 5).map((w) => (
              <Text key={w} variant="caption" tone="muted">
                {w}
              </Text>
            ))}
          </>
        ) : null}
      </Card>
    </StackScreen>
  );
}
