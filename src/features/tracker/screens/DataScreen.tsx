import { useState } from 'react';
import { Share } from 'react-native';

import { newId, useRepositories } from '@/lib/db';
import { Button, Card, Text } from '@/ui';

import { TextField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { CsvImportError } from '../logic/csvImport';
import { pickCsvText, shareCsvFile } from '../services/csvFiles';
import { exportAllCsv, importWorkoutCsv, type ImportSummary } from '../services/dataPort';

/**
 * CSV export of all own training data (hard rule 9) and Hevy/Strong import.
 *
 * Export writes a real .csv file and opens the share sheet (expo-file-system +
 * expo-sharing; plain-text share as fallback). Import reads a picked file
 * (expo-document-picker) or pasted CSV text.
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
      const shared = await shareCsvFile(out.csv).catch(() => false);
      if (!shared) await Share.share({ title: 'suppcity-trainingen.csv', message: out.csv });
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (text: string = csv) => {
    setBusy('import');
    setError(null);
    setResult(null);
    try {
      setResult(await importWorkoutCsv(repos, text, newId));
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
        <Button label="Exporteer als CSV" icon="share" loading={busy === 'export'} onPress={() => void doExport()} />
      </Card>

      <Card eyebrow="Importeren uit Hevy of Strong">
        <Text tone="secondary">
          Exporteer je data in Hevy (Profiel → Instellingen → Data exporteren) of Strong (Instellingen → Exporteer
          data) en kies het CSV-bestand of plak de inhoud hieronder. Onbekende oefeningen worden als eigen oefening
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
          style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 12, fontSize: 13, lineHeight: 18 }}
        />
        <Button label="Importeren" variant="secondary" disabled={!csv.trim()} loading={busy === 'import'} onPress={() => void doImport()} />
        <Button
          label="Kies CSV-bestand"
          variant="ghost"
          disabled={busy !== null}
          onPress={() =>
            void pickCsvText()
              .then((text) => (text ? doImport(text) : undefined))
              .catch(() => setError('Het bestand kon niet worden gelezen.'))
          }
        />
        {error ? <Text tone="danger">{error}</Text> : null}
        {result ? (
          <>
            <Text>
              {result.imported} training{result.imported === 1 ? '' : 'en'} geïmporteerd uit {result.format === 'hevy' ? 'Hevy' : 'Strong'}
              {result.skipped > 0 ? `, ${result.skipped} al aanwezig` : ''}.
            </Text>
            {result.createdExercises.length > 0 ? (
              <Text tone="secondary">Nieuwe eigen oefeningen: {result.createdExercises.join(', ')}</Text>
            ) : null}
            {result.warnings.slice(0, 5).map((w) => (
              <Text key={w} variant="caption" tone="tertiary">
                {w}
              </Text>
            ))}
          </>
        ) : null}
      </Card>
    </StackScreen>
  );
}
