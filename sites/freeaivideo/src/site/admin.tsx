import { type ReactNode, useCallback, useEffect, useState } from 'react';

// Internal stats panel for /admin; data comes from /api/admin/stats, which answers 404 to anyone
// but ADMIN_EMAIL. Never import *.server or paraglide files here: everything in this file ships to
// the browser, and this internal page is Chinese regardless of the site locale.

interface AdminStats {
  totals: {
    users: number;
    jobs: Record<string, number>;
    orders: number;
    ordersPending: number;
    payments: number;
    netRevenueUsd: number;
    upstreamCostUsd: number;
    creditsOutstanding: number;
  };
  daily: { day: string; signups: number; jobs: number }[];
  modelDist: { label: string | null; count: number }[];
  errorDist: { label: string | null; count: number }[];
  ledger: { kind: string; count: number; delta: number }[];
  sources: { label: string | null; count: number }[];
  referrers: { label: string | null; count: number }[];
  users: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: number;
    credits: number;
    jobs: number;
    source: string | null;
  }[];
  orders: { id: string; productId: string; amount: number; status: string; createdAt: number; email: string | null }[];
  payments: {
    id: string;
    productId: string;
    amount: number;
    amountRefunded: number;
    createdAt: number;
    email: string | null;
  }[];
  stuck: { id: string; modelId: string; status: string; createdAt: number; minutesOld: number; upstreamCostUsd: number }[];
  recentJobs: {
    id: string;
    modelId: string;
    status: string;
    costCredits: number;
    errorCode: string | null;
    upstreamCostUsd: number;
    durationSec: number | null;
    createdAt: number;
  }[];
}

const JOB_STATUS: Record<string, string> = {
  queued: '排队中',
  submitted: '已提交',
  succeeded: '成功',
  failed: '失败',
  canceled: '已取消',
};

const LEDGER_KIND: Record<string, string> = {
  grant: '发放',
  spend: '消耗',
  refund: '退款返还',
  revoke: '追回',
};

const ORDER_STATUS: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  expired: '已过期',
};

const number = (value: number) => value.toLocaleString('zh-CN');
const money = (value: number) => `$${value.toFixed(2)}`;
const cents = (value: number) => money(value / 100);
const time = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortId = (id: string) => `${id.slice(0, 15)}…`;
const duration = (sec: number | null) => {
  if (sec == null) return '—';
  if (sec < 90) return `${sec} 秒`;
  return `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
};

function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small distribution table used for models, errors, credit flow and signup sources. */
function Dist({ title, rows, empty }: { title: string; rows: { label: string | null; count: number }[]; empty: string }) {
  const visible = rows.filter((row) => row.label);
  return (
    <section className="admin-dist">
      <h2>{title}</h2>
      {visible.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {visible.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{number(row.count)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/stats').then(async (response) => {
      if (!response.ok) {
        setDenied(true);
        return;
      }
      setStats(((await response.json()) as { stats: AdminStats }).stats);
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  if (denied) return <p>无权访问。</p>;
  if (!stats) return <p className="muted">加载中…</p>;
  const { totals } = stats;
  const jobsTotal = Object.values(totals.jobs).reduce((sum, count) => sum + count, 0);
  const jobsLine = Object.entries(totals.jobs)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${JOB_STATUS[status] ?? status} ${count}`)
    .join(' · ');

  return (
    <>
      <h1>
        管理后台{' '}
        <button className="button" onClick={load} disabled={loading}>
          {loading ? '统计中…' : '刷新'}
        </button>
      </h1>

      <section>
        <h2>概览</h2>
        <dl className="admin-overview">
          <div>
            <dt>用户</dt>
            <dd>{number(totals.users)}</dd>
          </div>
          <div>
            <dt>任务</dt>
            <dd>
              {number(jobsTotal)}
              <span className="small muted"> {jobsLine}</span>
            </dd>
          </div>
          <div>
            <dt>订单</dt>
            <dd>
              {number(totals.orders)}
              {totals.ordersPending > 0 && <span className="small muted"> 待支付 {totals.ordersPending}</span>}
            </dd>
          </div>
          <div>
            <dt>净收入</dt>
            <dd>{money(totals.netRevenueUsd)}</dd>
          </div>
          <div>
            <dt>上游成本</dt>
            <dd>{money(totals.upstreamCostUsd)}</dd>
          </div>
          <div>
            <dt>未用积分</dt>
            <dd>{number(totals.creditsOutstanding)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>近 14 天</h2>
        <Table
          columns={['日期', '注册', '任务']}
          rows={stats.daily.map((row) => [row.day, number(row.signups), number(row.jobs)])}
        />
      </section>

      <section>
        <h2>用户（最近 20）</h2>
        <Table
          columns={['邮箱', '邮箱验证', '注册时间', '积分', '任务', '来源']}
          rows={stats.users.map((row) => [
            row.email,
            row.emailVerified ? '✓' : '—',
            time(row.createdAt),
            number(row.credits),
            number(row.jobs),
            row.source ?? '—',
          ])}
        />
      </section>

      <section>
        <h2>订单（最近 20）</h2>
        <Table
          columns={['时间', '商品', '金额', '状态', '用户']}
          rows={stats.orders.map((row) => [
            time(row.createdAt),
            row.productId,
            cents(row.amount),
            ORDER_STATUS[row.status] ?? row.status,
            row.email ?? '—',
          ])}
        />
      </section>

      {stats.payments.length > 0 && (
        <section>
          <h2>支付（最近 10）</h2>
          <Table
            columns={['时间', '商品', '金额', '已退款', '用户']}
            rows={stats.payments.map((row) => [
              time(row.createdAt),
              row.productId,
              cents(row.amount),
              row.amountRefunded > 0 ? cents(row.amountRefunded) : '—',
              row.email ?? '—',
            ])}
          />
        </section>
      )}

      <section>
        <h2>卡住的任务</h2>
        {stats.stuck.length === 0 ? (
          <p className="muted">没有卡住的任务。</p>
        ) : (
          <Table
            columns={['任务', '模型', '状态', '已等待', '上游成本', '创建时间']}
            rows={stats.stuck.map((job) => [
              shortId(job.id),
              job.modelId,
              `${JOB_STATUS[job.status] ?? job.status}（${job.minutesOld} 分钟）`,
              job.upstreamCostUsd > 0 ? money(job.upstreamCostUsd) : '—',
              time(job.createdAt),
            ])}
          />
        )}
      </section>

      <section>
        <h2>最近任务</h2>
        <Table
          columns={['时间', '任务', '模型', '状态', '积分', '上游成本', '耗时', '错误']}
          rows={stats.recentJobs.map((job) => [
            time(job.createdAt),
            shortId(job.id),
            job.modelId,
            JOB_STATUS[job.status] ?? job.status,
            number(job.costCredits),
            job.upstreamCostUsd > 0 ? money(job.upstreamCostUsd) : '—',
            duration(job.durationSec),
            job.errorCode ?? '—',
          ])}
        />
      </section>

      <section className="admin-dists">
        <Dist title="模型分布" rows={stats.modelDist} empty="还没有任务。" />
        <Dist title="失败原因" rows={stats.errorDist} empty="没有失败任务。" />
        <Dist title="积分流水" rows={stats.ledger.map((row) => ({ label: LEDGER_KIND[row.kind] ?? row.kind, count: row.count }))} empty="没有积分流水。" />
        <Dist title="注册来源（utm_source）" rows={stats.sources} empty="没有归因数据。" />
        <Dist title="来源站点（referrer）" rows={stats.referrers} empty="没有来源数据。" />
      </section>
    </>
  );
}
