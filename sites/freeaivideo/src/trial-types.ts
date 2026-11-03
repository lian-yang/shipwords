export type GenerationMode = 'daily-trial' | 'signup-trial' | 'paid';

// Public protocol identifiers shared with the generator's error and availability UI.
export const trialErrors = {
  verification: 'trial_verification_failed',
  unavailable: 'trial_unavailable',
  quota: 'trial_quota_exhausted',
  signupUnavailable: 'signup_trial_unavailable',
  signupUsed: 'signup_trial_used',
  signupExpired: 'signup_trial_expired',
  signupLimit: 'signup_trial_limit',
} as const;
export const trialReasons = { verificationUnavailable: 'verification_unavailable' } as const;

export interface TrialStatus {
  verificationAvailable: boolean;
  daily: {
    available: boolean;
    remaining: number;
    reason: 'quota' | 'verification_unavailable' | null;
  };
  signup: {
    status:
      | 'available'
      | 'claimable'
      | 'used'
      | 'expired'
      | 'ineligible'
      | 'daily_limit'
      | 'unverified'
      | 'signed_out';
    expiresAt: number | null;
  };
}
