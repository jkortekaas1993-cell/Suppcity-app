import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen, Segmented } from '@/ui';

import { BodyView } from '../components/BodyView';
import { ExerciseView } from '../components/ExerciseView';
import { WeekView } from '../components/WeekView';
import { useWeekSummary } from '../useWeekSummary';

type ProgressView = 'oefening' | 'week' | 'lichaam';

const VIEWS: readonly { value: ProgressView; label: string }[] = [
  { value: 'oefening', label: 'Oefening' },
  { value: 'week', label: 'Week' },
  { value: 'lichaam', label: 'Lichaam' },
];

/**
 * Voortgang (docs/design/mockups/Voortgang.dc.html). Unlimited history, free.
 * Read-only on local tracker data; nothing leaves the device (hard rule 1).
 */
export function ProgressScreen() {
  const router = useRouter();
  const [view, setView] = useState<ProgressView>('oefening');
  const week = useWeekSummary();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/trainen'));

  return (
    <Screen title="Voortgang" onBack={back} testID="progress-screen">
      <Segmented options={VIEWS} value={view} onChange={setView} accessibilityLabel="Weergave" />
      {view === 'oefening' ? <ExerciseView week={week.data} /> : null}
      {view === 'week' ? <WeekView week={week.data} loading={week.loading} /> : null}
      {view === 'lichaam' ? <BodyView /> : null}
    </Screen>
  );
}
