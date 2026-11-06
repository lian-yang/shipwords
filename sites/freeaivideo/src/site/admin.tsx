import { useEffect, useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';

// Internal stats panel for /admin; data comes from /api/admin/stats, which answers 404 to anyone
// but ADMIN_EMAIL. Never import *.server files here: everything in this file ships to the browser.

interface AdminStats {
  totals: {
    users: number;
    jobs: Record<string, number>;
    orders: number;
    ordersPending: number;
    payments: number;
    netRevenueUsd: number;
    creditsOutstanding: number;
  };
  signups: { day: string; count: number }[];
  recentJobs: {
    id: string;
    modelId: string;
    status: string;
    costCredits: number;
    errorCode: string | null;
    createdAt: number;
  }[];
  stuck: { id: string; modelId: string; status: string; createdAt: number; minutesOld: number }[];
}

const locale = () => (getLocale() === 'zh' ? 'zh-CN' : 'en-US');
const number = (value: number) => value.toLocaleString(locale());
const money = (value: number) =>
  value.toLocaleString(locale(), { style: 'currency', currency: 'USD' });
const dateTime = (ms: number) =>
  new Date(ms).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const shortId = (id: string) => `${id.slice(0, 15)}…`;

const JOB_STATUS_ORDER = ['queued', 'submitted', 'succeeded', 'failed', 'canceled'] as const;

function jobsLine(jobs: Record<string, number>): string {
  return JOB_STATUS_ORDER.filter((status) => jobs[status]).join(' · ');
}

export function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/stats').then(async (response) => {
      if (!alive) return;
      if (!response.ok) {
        setDenied(true);
        return;
      }
      setStats(((await response.json()) as { stats: AdminStats }).stats);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (denied) return <p>{m.admin_denied()}</p>;
  if (!stats) return <p className="muted">{m.admin_loading()}</p>;
  const { totals } = stats;

  return (
    <>
      <h1>{m.admin_heading()}</h1>
      <section>
        <h2>{m.admin_section_overview()}</h2>
        <dl className="admin-overview">
          <div>
            <dt>{m.admin_users()}</dt>
            <dd>{number(totals.users)}</dd>
          </div>
          <div>
            <dt>{m.admin_jobs()}</dt>
            <dd>
              {number(Object.values(totals.jobs).reduce((sum, count) => sum + count, 0))}
              <span className="small muted"> {jobsLine(totals.jobs)}</span>
            </dd>
          </div>
          <div>
            <dt>{m.admin_orders()}</dt>
            <dd>
              {number(totals.orders)}
              {totals.ordersPending > 0 && (
                <span className="small muted"> {m.admin_orders_pending({ count: totals.ordersPending })}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>{m.admin_revenue()}</dt>
            <dd>{money(totals.netRevenueUsd)}</dd>
          </div>
          <div>
            <dt>{m.admin_credits_outstanding()}</dt>
            <dd>{number(totals.creditsOutstanding)}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>{m.admin_section_stuck()}</h2>
        {stats.stuck.length === 0 ? (
          <p className="muted">{m.admin_stuck_none()}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{m.admin_column_job()}</th>
                <th scope="col">{m.admin_column_model()}</th>
                <th scope="col">{m.admin_column_status()}</th>
                <th scope="col">{m.admin_column_created()}</th>
              </tr>
            </thead>
            <tbody>
              {stats.stuck.map((job) => (
                <tr key={job.id}>
                  <td>{shortId(job.id)}</td>
                  <td>{job.modelId}</td>
                  <td>
                    {job.status} <span className="small muted">{m.admin_stuck_minutes({ minutes: job.minutesOld })}</span>
                  </td>
                  <td>{dateTime(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>{m.admin_section_signups()}</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">{m.admin_column_day()}</th>
              <th scope="col">{m.admin_column_count()}</th>
            </tr>
          </thead>
          <tbody>
            {stats.signups.map((row) => (
              <tr key={row.day}>
                <td>{row.day}</td>
                <td>{number(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>{m.admin_section_recent()}</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">{m.admin_column_job()}</th>
              <th scope="col">{m.admin_column_model()}</th>
              <th scope="col">{m.admin_column_status()}</th>
              <th scope="col">{m.admin_column_cost()}</th>
              <th scope="col">{m.admin_column_error()}</th>
              <th scope="col">{m.admin_column_created()}</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentJobs.map((job) => (
              <tr key={job.id}>
                <td>{shortId(job.id)}</td>
                <td>{job.modelId}</td>
                <td>{job.status}</td>
                <td>{number(job.costCredits)}</td>
                <td>{job.errorCode ?? '—'}</td>
                <td>{dateTime(job.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
