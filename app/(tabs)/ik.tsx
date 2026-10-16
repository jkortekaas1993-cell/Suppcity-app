import { IkScreen } from '@/features/account';
import { PointsPanel } from '@/features/points';

/**
 * Ik tab; the points feature supplies its card for signed-in users. Slots still open for
 * the integrator: `badgesSlot` (tracker's BadgesSection), `memberSince`/`workoutCount`
 * (tracker data), `challengeSlot` (release 2b, stays empty in 2a).
 */
export default function Ik() {
  return <IkScreen pointsSlot={<PointsPanel />} />;
}
