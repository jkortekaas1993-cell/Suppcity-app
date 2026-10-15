import { Redirect } from 'expo-router';

/**
 * Landing route for the OAuth redirect (shop.<SHOP_ID>.app://auth/callback).
 * WebBrowser.openAuthSessionAsync normally captures the redirect itself; on some
 * Android setups the deep link also reaches the router, so send the user back to Ik.
 */
export default function AuthCallback() {
  return <Redirect href="/ik" />;
}
