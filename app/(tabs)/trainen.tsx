import { ProgressEntryCard } from '@/features/progress';
import { TrainenScreen } from '@/features/tracker';

/** Trainen (free of ads and the shop): the Voortgang entry card opens /progress. */
export default function Trainen() {
  return <TrainenScreen progressCard={<ProgressEntryCard />} />;
}
