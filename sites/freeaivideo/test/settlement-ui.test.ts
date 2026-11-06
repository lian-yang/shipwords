import type { PublicJob } from '@shipwords/jobs/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JobCard } from '../src/routes/index';
import { resultStatus } from '../src/site/account';

const base: PublicJob = {
  id: 'job_settlement_test',
  modelId: 'example',
  status: 'failed',
  prompt: 'A test prompt',
  costCredits: 10,
  settlement: 'pending',
  outputs: [],
  error: { code: 'billing_pending' },
  createdAt: 1,
  finishedAt: 2,
};

function card(job: PublicJob) {
  return renderToStaticMarkup(createElement(JobCard, { job, onCancel: () => {} }));
}

describe('settlement status visible to customers', () => {
  it('shows billing as pending and credits as not yet returned on both surfaces', () => {
    const html = card(base);
    const account = resultStatus(base);
    expect(html).toContain('billing status is pending');
    expect(html).toContain('credits have not yet been returned');
    expect(html).toContain('job_settlement_test');
    expect(html).not.toContain('went back to your account');
    expect(account).toContain('billing status is pending');
    expect(account).toContain('credits have not yet been returned');
    expect(account).not.toContain('credits returned');
  });

  it('shows a return only after refund settlement and distinguishes provider charges', () => {
    const refunded = { ...base, settlement: 'refunded' as const };
    const charged = { ...base, settlement: 'charged' as const };
    expect(card(refunded)).toContain('went back to your account');
    expect(resultStatus(refunded)).toContain('credits returned');
    expect(card(charged)).toContain('provider has charged');
    expect(resultStatus(charged)).toContain('provider charged');
  });

  it('shows canceled credit returns as pending and free trials as used', () => {
    const canceled = { ...base, status: 'canceled' as const };
    expect(card(canceled)).toContain('credit return is pending');
    expect(resultStatus(canceled)).toContain('credit return pending');
    const free = { ...base, costCredits: 0, settlement: 'not_applicable' as const };
    expect(card(free)).toContain('trial allowance has been used');
    expect(resultStatus(free)).not.toContain('credits returned');
  });
});
