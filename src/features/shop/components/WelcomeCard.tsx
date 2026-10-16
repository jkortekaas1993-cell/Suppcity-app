import { Appear, Button, Card, Text } from '@/ui';

import { APP_DISCOUNT_CODE } from '../config';
import { useDismissible } from '../state/flags';

/**
 * Calm, once-dismissible welcome card for the app discount. No pop-up, no timer.
 * Hidden when no code is configured. The code is applied to new carts automatically.
 */
export function WelcomeCard() {
  const { visible, dismiss } = useDismissible('shop.welcomeCard.dismissed.v1');
  if (!APP_DISCOUNT_CODE || !visible) return null;
  return (
    <Appear index={1}>
      <Card eyebrow="Welkom in de app">
        <Text tone="secondary">
          Bestel je via de app, dan zit code{' '}
          <Text variant="bodyStrong" tnum>
            {APP_DISCOUNT_CODE}
          </Text>{' '}
          er automatisch in.
        </Text>
        <Button label="Begrepen" variant="ghost" size="sm" onPress={dismiss} />
      </Card>
    </Appear>
  );
}
