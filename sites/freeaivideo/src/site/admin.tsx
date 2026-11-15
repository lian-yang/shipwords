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
    upstreamConfirmedUsd: number;
    upstreamOtherRecordedUsd: number;
    billingPending: number;
    billingTotal: number;
    creditsOutstanding: number;
  };
  daily: { day: string; signups: number; jobs: number; checkouts: number; paid: number }[];
  funnel: {
    signups: number;
    activated: number;
    checkouts: number;
    paidOrders: number;
    paidUsers: number;
  };
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
  orders: {
    id: string;
    productId: string;
    amount: number;
    status: string;
    createdAt: number;
    email: string | null;
  }[];
  payments: {
    id: string;
    productId: string;
    amount: number;
    amountRefunded: number;
    createdAt: number;
    email: string | null;
  }[];
  stuck: {
    id: string;
    modelId: string;
    status: string;
    createdAt: number;
    minutesOld: number;
    upstreamCostUsd: number;
  }[];
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
  billingReview: {
    id: string;
    modelId: string;
    status: string;
    billingStatus: string;
    costCredits: number;
    upstreamCostUsd: string | null;
    refunded: boolean;
    createdAt: number;
    pendingKeys: { index: number; key: string }[] | null;
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
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
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

type TableRow = [id: string, ...cells: ReactNode[]];

function Table({ headingId, columns, rows }: { headingId: string; columns: string[]; rows: TableRow[] }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: users must be able to reach the scrollable table by keyboard.
    <section className="admin-table-scroll" aria-labelledby={headingId} tabIndex={0}>
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
          {rows.map(([id, ...cells]) => (
            <tr key={id}>
              {columns.map((column, index) => (
                <td key={column}>{cells[index]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Small distribution table used for models, errors, credit flow and signup sources. */
function Dist({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string | null; count: number }[];
  empty: string;
}) {
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
  const [billingOffset, setBillingOffset] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/stats?billingOffset=${billingOffset}`).then(async (response) => {
      if (!response.ok) {
        setDenied(true);
        return;
      }
      setStats(((await response.json()) as { stats: AdminStats }).stats);
      setLoading(false);
    });
  }, [billingOffset]);

  useEffect(load, [load]);

  if (!stats || denied) {
    return (
      <>
        <header className="admin-heading">
          <h1 id="admin-title">管理后台</h1>
        </header>
        <p className="muted" role="status">
          {denied ? '无权访问。' : '加载中…'}
        </p>
      </>
    );
  }
  const { totals } = stats;
  const jobsTotal = Object.values(totals.jobs).reduce((sum, count) => sum + count, 0);
  const jobsLine = Object.entries(totals.jobs)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${JOB_STATUS[status] ?? status} ${count}`)
    .join(' · ');

  return (
    <>
      <header className="admin-heading">
        <h1 id="admin-title">管理后台</h1>
        <button type="button" className="button" onClick={load} disabled={loading}>
          {loading ? '统计中…' : '刷新'}
        </button>
      </header>

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
              {totals.ordersPending > 0 && (
                <span className="small muted"> 待支付 {totals.ordersPending}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>净收入</dt>
            <dd>{money(totals.netRevenueUsd)}</dd>
          </div>
          <div>
            <dt>已核实失败任务成本</dt>
            <dd>{money(totals.upstreamConfirmedUsd)}</dd>
          </div>
          <div>
            <dt>其他已记录成本（状态未区分）</dt>
            <dd>{money(totals.upstreamOtherRecordedUsd)}</dd>
          </div>
          <div>
            <dt>待核账任务</dt>
            <dd>{number(totals.billingPending)}</dd>
          </div>
          <div>
            <dt>未用积分</dt>
            <dd>{number(totals.creditsOutstanding)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 id="admin-billing">上游账单核查（共 {number(totals.billingTotal)} 条，待核优先）</h2>
        <p className="muted">
          待核账任务的实际费用还未确认。如果长时间未结算，或记录已超过保留期，请在 Yir
          控制台核对，也可以把任务标识和幂等键提供给 Yir 支持。自动退款需要上游结算证据。
        </p>
        {stats.billingReview.length === 0 ? (
          <p className="muted">没有需要展示的账单核查记录。</p>
        ) : (
          <Table
            headingId="admin-billing"
            columns={['时间', '本站任务', '模型', '积分', '核账状态', '上游成本', '退款', 'Yir 核查幂等键']}
            rows={stats.billingReview.map((job) => [
              job.id,
              time(job.createdAt),
              job.id,
              job.modelId,
              number(job.costCredits),
              (
                {
                  billing_pending: '等待上游结算',
                  billing_refunding: '零费用已确认，退款处理中',
                  billing_refunded: '零费用已确认，积分已退',
                  billing_charged: '上游已收费',
                } as Record<string, string>
              )[job.billingStatus] ?? job.billingStatus,
              job.billingStatus === 'billing_pending'
                ? '未知'
                : job.upstreamCostUsd == null
                  ? '未知'
                  : `$${job.upstreamCostUsd}`,
              job.refunded ? '已退积分' : '未退积分',
              job.pendingKeys === null
                ? '无法读取幂等键，请联系技术支持。'
                : job.pendingKeys.length === 0
                  ? '—'
                  : job.pendingKeys.map((slot) => (
                      <p key={slot.index}>
                        <code>{slot.key}</code>
                      </p>
                    )),
            ])}
          />
        )}
        <div className="admin-pagination">
          <button
            type="button"
            disabled={billingOffset === 0 || loading}
            onClick={() => setBillingOffset(Math.max(0, billingOffset - 100))}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={billingOffset + 100 >= totals.billingTotal || loading}
            onClick={() => setBillingOffset(billingOffset + 100)}
          >
            下一页
          </button>
        </div>
      </section>

      <section>
        <h2>近 14 天漏斗</h2>
        <p className="muted">
          注册 {number(stats.funnel.signups)} → 首次生成 {number(stats.funnel.activated)}（
          {pct(stats.funnel.activated, stats.funnel.signups)}）→ 发起结账 {number(stats.funnel.checkouts)}（
          {pct(stats.funnel.checkouts, stats.funnel.signups)}）→ 付款 {number(stats.funnel.paidOrders)} 单 /{' '}
          {number(stats.funnel.paidUsers)} 人（{pct(stats.funnel.paidUsers, stats.funnel.signups)}）
        </p>
      </section>

      <section>
        <h2 id="admin-daily">近 14 天</h2>
        <Table
          headingId="admin-daily"
          columns={['日期', '注册', '任务', '发起结账', '付款']}
          rows={stats.daily.map((row) => [
            row.day,
            row.day,
            number(row.signups),
            number(row.jobs),
            number(row.checkouts),
            number(row.paid),
          ])}
        />
      </section>

      <section>
        <h2 id="admin-users">用户（最近 20）</h2>
        <Table
          headingId="admin-users"
          columns={['邮箱', '邮箱验证', '注册时间', '积分', '任务', '来源']}
          rows={stats.users.map((row) => [
            row.id,
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
        <h2 id="admin-orders">订单（最近 20）</h2>
        <Table
          headingId="admin-orders"
          columns={['时间', '商品', '金额', '状态', '用户']}
          rows={stats.orders.map((row) => [
            row.id,
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
          <h2 id="admin-payments">支付（最近 10）</h2>
          <Table
            headingId="admin-payments"
            columns={['时间', '商品', '金额', '已退款', '用户']}
            rows={stats.payments.map((row) => [
              row.id,
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
        <h2 id="admin-stuck">卡住的任务</h2>
        {stats.stuck.length === 0 ? (
          <p className="muted">没有卡住的任务。</p>
        ) : (
          <Table
            headingId="admin-stuck"
            columns={['任务', '模型', '状态', '已等待', '上游成本', '创建时间']}
            rows={stats.stuck.map((job) => [
              job.id,
              shortId(job.id),
              job.modelId,
              JOB_STATUS[job.status] ?? job.status,
              `${job.minutesOld} 分钟`,
              job.upstreamCostUsd > 0 ? money(job.upstreamCostUsd) : '—',
              time(job.createdAt),
            ])}
          />
        )}
      </section>

      <section>
        <h2 id="admin-jobs">最近任务</h2>
        <Table
          headingId="admin-jobs"
          columns={['时间', '任务', '模型', '状态', '积分', '上游成本', '耗时', '错误']}
          rows={stats.recentJobs.map((job) => [
            job.id,
            time(job.createdAt),
            shortId(job.id),
            job.modelId,
            JOB_STATUS[job.status] ?? job.status,
            number(job.costCredits),
            job.errorCode === 'billing_pending'
              ? '未知'
              : job.upstreamCostUsd > 0
                ? `${money(job.upstreamCostUsd)}（已记录）`
                : '—',
            duration(job.durationSec),
            job.errorCode ?? '—',
          ])}
        />
      </section>

      <section className="admin-dists">
        <Dist title="模型分布" rows={stats.modelDist} empty="还没有任务。" />
        <Dist title="失败原因" rows={stats.errorDist} empty="没有失败任务。" />
        <Dist
          title="积分流水"
          rows={stats.ledger.map((row) => ({ label: LEDGER_KIND[row.kind] ?? row.kind, count: row.count }))}
          empty="没有积分流水。"
        />
        <Dist title="注册来源（utm_source）" rows={stats.sources} empty="没有归因数据。" />
        <Dist title="来源站点（referrer）" rows={stats.referrers} empty="没有来源数据。" />
      </section>
    </>
  );
}
