import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Real-file CSV I/O for the Data screen (hard rule 9). Expo SDK 54 APIs:
 * expo-file-system (File/Paths), expo-sharing and expo-document-picker.
 */

export const EXPORT_FILE_NAME = 'suppcity-trainingen.csv';

/** Writes the CSV to the cache directory and opens the OS share sheet. Returns false if sharing is unavailable. */
export async function shareCsvFile(csv: string, fileName = EXPORT_FILE_NAME): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Exporteer trainingen' });
  return true;
}

/** Lets the user pick a CSV file (Hevy/Strong export) and returns its text, or null when cancelled. */
export async function pickCsvText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  return new File(asset.uri).text();
}
