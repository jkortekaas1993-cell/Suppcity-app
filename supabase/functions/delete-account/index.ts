import { createClient } from '@supabase/supabase-js';

import { bearer } from '../_shared/cors.ts';
import { handleDeleteAccount } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleDeleteAccount(req, bearer(req), {
    async userFromJwt(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    async deleteAccount(userId) {
      // SQL path (not auth.admin.deleteUser) so log + delete are one transaction.
      const { data, error } = await admin.rpc('delete_account', { p_user_id: userId, p_reason: 'user_request' });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    log: (event, data) => console.log(JSON.stringify({ fn: 'delete-account', event, ...data })),
  }),
);
