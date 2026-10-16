import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

import { fontFamily } from './tokens';

/** Font map for `useFonts` (app/_layout.tsx). Keys are the family names used in tokens.ts. */
export const FONT_ASSETS = {
  [fontFamily.condensedSemiBold]: BarlowCondensed_600SemiBold,
  [fontFamily.condensedBold]: BarlowCondensed_700Bold,
  [fontFamily.condensedExtraBold]: BarlowCondensed_800ExtraBold,
  [fontFamily.regular]: Barlow_400Regular,
  [fontFamily.medium]: Barlow_500Medium,
  [fontFamily.semiBold]: Barlow_600SemiBold,
  [fontFamily.bold]: Barlow_700Bold,
};

/** After this long the app renders with the system font instead of waiting on the splash. */
export const FONT_LOAD_TIMEOUT_MS = 2500;
