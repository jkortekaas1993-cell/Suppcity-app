import { ReorderCard } from '@/features/shop';
import { VandaagScreen } from '@/features/tracker';

/** Vandaag shows at most one smart card from outside the tracker. */
export default function Vandaag() {
  return <VandaagScreen smartCard={<ReorderCard />} />;
}
