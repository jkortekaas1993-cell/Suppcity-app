import { createClient } from '@supabase/supabase-js';

import { handleWebhook } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

Deno.serve((req) =>
  handleWebhook(req, {
    // Client secret of the Shopify app that owns the webhook subscriptions; the
    // _PREVIOUS one is only set during secret rotation.
    secrets: [Deno.env.get('SHOPIFY_WEBHOOK_SECRET'), Deno.env.get('SHOPIFY_WEBHOOK_SECRET_PREVIOUS')],
    shopDomain: Deno.env.get('SHOPIFY_SHOP_DOMAIN')!, // e.g. suppcity.myshopify.com
    awardOrderPoints: (c, o, p) => rpc<string>('award_order_points', { p_customer_gid: c, p_order_gid: o, p_points: p }),
    async recordPrivacyRequest(r) {
      const { error } = await admin.from('shopify_privacy_requests').insert({
        topic: r.topic,
        shopify_webhook_id: r.webhookId,
        shop_domain: r.shopDomain,
        customer_gid: r.customerGid,
        status: r.status,
        completed_at: r.status === 'received' ? null : new Date().toISOString(),
      });
      if (error?.code === '23505') return false; // duplicate delivery
      if (error) throw error;
      return true;
    },
    hasCustomerData: async (c) => (await rpc<unknown>('export_customer_data', { p_customer_gid: c })) !== null,
    findUserByCustomer: async (c) => {
      const { data, error } = await admin.from('profiles').select('user_id').eq('shopify_customer_id', c).maybeSingle();
      if (error) throw error;
      return data?.user_id ?? null;
    },
    deleteAccount: async (u) => {
      await rpc('delete_account', { p_user_id: u, p_reason: 'shopify_redact' });
    },
    redactShop: async () => {
      await rpc('redact_shop_identifiers', {});
    },
    log: (event, data) => console.log(JSON.stringify({ fn: 'shopify-webhooks', event, ...data })),
  }),
);
