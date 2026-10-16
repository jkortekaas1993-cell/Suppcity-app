import { EmptyState } from '@/ui';

/**
 * Voortgang → Lichaam. Body weight and measurements arrive in release 2b (body_metrics,
 * with its own consent and local by default). Release 2a stores nothing here.
 */
export function BodyView() {
  return (
    <EmptyState
      icon="user"
      title="Lichaamsgewicht bijhouden komt binnenkort"
      body="Straks houd je hier je gewicht en omvang bij. Dat vragen we apart aan je, en het blijft standaard alleen op je telefoon."
      testID="progress-body-soon"
    />
  );
}
