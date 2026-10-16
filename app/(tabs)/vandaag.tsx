import { WeekVolumeTile } from '@/features/progress';
import { ReorderCard } from '@/features/shop';
import { getSupplementStockForReorder, SupplementTodayCard } from '@/features/supplements';
import { VandaagScreen } from '@/features/tracker';

/**
 * Vandaag (mockup Main.dc.html): the tracker's screen with one supplement card, the
 * "Volume week" tile from Voortgang and exactly ONE smart card (ReorderCard). The
 * ReorderCard also gets the supplement schedule's "running low" signals: only variant,
 * name and days left, never intake data (hard rule 1).
 */
const loadSupplementSignals = () => getSupplementStockForReorder();

export default function Vandaag() {
  return (
    <VandaagScreen
      weekVolumeTile={<WeekVolumeTile />}
      supplementCard={<SupplementTodayCard />}
      smartCard={<ReorderCard loadExternalSignals={loadSupplementSignals} />}
    />
  );
}
