import { View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

import { APP_DISCOUNT_CODE } from '../config';
import { useDismissible } from '../state/flags';

/**
 * Calm, once-dismissible welcome card for the app discount. No pop-up, no timer.
 * Hidden when no code is configured. The code is applied to new carts automatically.
 */
export function WelcomeCard() {
  const { space } = useTheme();
  const { visible, dismiss } = useDismissible('shop.welcomeCard.dismissed.v1');
  if (!APP_DISCOUNT_CODE || !visible) return null;
  return (
    <Card eyebrow="Welkom in de app">
      <Text>
        Bestel je via de app, dan zit code <Text variant="heading">{APP_DISCOUNT_CODE}</Text> er automatisch in.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Begrepen" variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}
