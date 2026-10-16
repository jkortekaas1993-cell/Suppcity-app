import { router } from 'expo-router';

import { ListRow } from '@/ui';

/** Row for the Ik tab (put it inside a Card with padding 0). */
export function SupplementsLink({ divider = false }: { divider?: boolean }) {
  return (
    <ListRow
      title="Mijn supplementen"
      subtitle="Schema, afvinken en voorraad"
      leading="pill"
      divider={divider}
      onPress={() => router.push('/supplements')}
    />
  );
}
