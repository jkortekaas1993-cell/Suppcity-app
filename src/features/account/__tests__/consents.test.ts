import { CONSENT_TYPES } from '@/lib/supabase/consents';

import { FEATURES } from '@/lib/config/constants';

import { applyConsent, CONSENT_COPY, CONSENT_ORDER, visibleConsents } from '../consentCopy';

describe('consents (hard rule 2)', () => {
  it('toggles one consent without touching the others', () => {
    const start = [
      { type: 'marketing_email' as const, granted: false, policyVersion: null, changedAt: null },
      { type: 'analytics' as const, granted: true, policyVersion: 'p0', changedAt: '2026-01-01T00:00:00Z' },
    ];
    const next = applyConsent(start, 'marketing_email', true, '2026-10-15T10:00:00Z', 'p1');
    expect(next[0]).toEqual({ type: 'marketing_email', granted: true, policyVersion: 'p1', changedAt: '2026-10-15T10:00:00Z' });
    expect(next[1]).toBe(start[1]);
    expect(applyConsent(start, 'pt_share', true, 't', 'p1')).toHaveLength(3);
  });
  it('has Dutch copy for exactly the backend consent types', () => {
    expect([...CONSENT_ORDER].sort()).toEqual([...CONSENT_TYPES].sort());
    expect(Object.keys(CONSENT_COPY).sort()).toEqual([...CONSENT_TYPES].sort());
  });
  it('hides the health_sync toggle until a Health integration exists (C2)', () => {
    expect(FEATURES.healthSync).toBe(false);
    expect(visibleConsents(FEATURES)).not.toContain('health_sync');
    expect(visibleConsents({ healthSync: true })).toContain('health_sync');
    expect(visibleConsents(FEATURES)).toHaveLength(CONSENT_ORDER.length - 1);
  });
});
