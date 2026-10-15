// Deno entrypoint: wires real dependencies into the pure handler.
import { createClient } from '@supabase/supabase-js';

import { customerApiUrl, verifyCustomerToken } from '../_shared/shopifyCustomer.ts';
import { handleAuthExchange, type Session } from './handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const STORE_DOMAIN = Deno.env.get('SHOPIFY_STOREFRONT_DOMAIN')!; // e.g. suppcity.nl
const API_URL = customerApiUrl(STORE_DOMAIN, Deno.env.get('SHOPIFY_CUSTOMER_API_URL') ?? undefined);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) =>
  handleAuthExchange(req, {
    verifyToken: (token) => verifyCustomerToken(token, API_URL, fetch),
    syntheticEmail: (gid) => `shopify-${gid.replace(/^gid:\/\/shopify\/Customer\//, '')}@auth.suppcity.nl`,
    async findUser(gid) {
      const { data, error } = await admin.rpc('find_user_for_shopify_customer', { p_customer_gid: gid });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    async createUser(email, gid) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(), // never stored or returned
        app_metadata: { provider: 'shopify', shopify_customer_id: gid },
      });
      if (error) {
        if (error.status === 422 || /already/i.test(error.message)) return { alreadyExists: true as const };
        throw error;
      }
      return { id: data.user.id };
    },
    async linkCustomer(userId, gid) {
      const { error } = await admin.rpc('link_shopify_customer', { p_user_id: userId, p_customer_gid: gid });
      if (error) throw error;
    },
    async isAdultConfirmed(userId) {
      const { data, error } = await admin.from('profiles').select('adult_confirmed_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return !!data?.adult_confirmed_at;
    },
    async mintSession(email): Promise<Session> {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (error) throw error;
      // Fresh anon client per request: verifyOtp must not touch shared client state.
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: v, error: vErr } = await anon.auth.verifyOtp({
        token_hash: data.properties.hashed_token,
        type: 'magiclink',
      });
      if (vErr || !v.session) throw vErr ?? new Error('no session');
      return v.session as Session;
    },
    log: (event, data) => console.log(JSON.stringify({ fn: 'shopify-auth-exchange', event, ...data })),
  }),
);
