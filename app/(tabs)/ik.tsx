import { IkScreen } from '@/features/account';
import { PointsPanel } from '@/features/points';
import { SupplementsLink } from '@/features/supplements';
import { BadgesSection } from '@/features/tracker';
import { useTrainingProfile } from '@/integration';

/**
 * Ik tab: points (signed-in), milestones (local badges), the supplement schedule row and
 * the "Lid sinds … · N workouts" line from local tracker data. The monthly challenge
 * (`challengeSlot`) arrives in release 2b and stays empty in 2a.
 */
export default function Ik() {
  const profile = useTrainingProfile();
  return (
    <IkScreen
      pointsSlot={<PointsPanel />}
      badgesSlot={<BadgesSection />}
      memberSince={profile?.memberSince ?? null}
      workoutCount={profile?.workoutCount ?? null}
      supplementsRow={({ divider }) => <SupplementsLink divider={divider} />}
    />
  );
}
