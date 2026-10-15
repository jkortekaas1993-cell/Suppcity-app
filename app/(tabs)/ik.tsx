import { IkScreen } from '@/features/account';
import { PointsPanel } from '@/features/points';

/** Ik tab; the points feature supplies its panel for signed-in users. */
export default function Ik() {
  return <IkScreen pointsSlot={<PointsPanel />} />;
}
