import { exportSupplementsCsv } from '@/features/supplements';
import { DataScreen, type ExtraCsvExport } from '@/features/tracker';

/** Hard rule 9: the supplement schedule and intake log export next to the training CSV. */
const EXTRA_EXPORTS: ExtraCsvExport[] = [
  {
    title: 'Supplementen',
    body: 'Je supplementen, schema en afvinklijst als CSV. Deze gegevens staan alleen op dit toestel.',
    load: () => exportSupplementsCsv(),
  },
];

export default function Data() {
  return <DataScreen extraExports={EXTRA_EXPORTS} />;
}
