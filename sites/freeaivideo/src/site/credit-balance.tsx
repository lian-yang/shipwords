import { createContext, useContext } from 'react';
import type { useCreditBalance } from '~/lib/use-credit-balance';

/** One balance snapshot shared by the header and generator for the current session. */
export const CreditBalanceContext = createContext<ReturnType<typeof useCreditBalance> | null>(null);

export function useSharedCreditBalance() {
  const balance = useContext(CreditBalanceContext);
  if (!balance) throw new Error('CreditBalanceContext is missing');
  return balance;
}
