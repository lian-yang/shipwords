import { analyticsScripts } from '@shipwords/core/analytics';
import { captureAttribution } from '@shipwords/core/react/attribution';
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { guardAnalyticsScripts } from '~/lib/analytics-head';
import { authClient } from '~/lib/auth';
import { getPublicConfig } from '~/lib/public-config';
import { flushConfirmedPayment } from '~/lib/track';
import { useCreditBalance } from '~/lib/use-credit-balance';
import { m } from '~/paraglide/messages.js';
import { getLocale, setLocale } from '~/paraglide/runtime.js';
import { AccountDialog, AccountLink } from '~/site/account';
import { CreditBalanceContext } from '~/site/credit-balance';
import { SUPPORT_EMAIL } from '~/site/legal';
import { PricingDialog, PricingLink } from '~/site/pricing';
import { openSignIn, promptGoogleOneTap, SignInDialog } from '~/site/sign-in';
import appCss from '~/site/styles.css?url';
import site from '../../site.config';

export const Route = createRootRoute({
  loader: () => getPublicConfig(),
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Analytics scripts are skipped in local dev so dev traffic stays out of reports.
    // Checkout returns contain an order id in the URL. Do not load any analytics
    // there, including automatic page views; the paid event is deferred to a clean URL.
    scripts: import.meta.env.DEV ? [] : guardAnalyticsScripts(analyticsScripts(site)),
  }),
  shellComponent: Document,
  component: Layout,
  notFoundComponent: NotFound,
});

// 404: React 19 hoists title and meta into head. Lists the main entry points; each site adds its own pages.
function NotFound() {
  return (
    <section className="legal">
      <title>{m.common_not_found_title({ name: site.name })}</title>
      <meta name="robots" content="noindex" />
      <h1>{m.common_not_found_heading()}</h1>
      <p>{m.common_not_found_intro()}</p>
      <ul>
        <li>
          <Link to="/">{m.common_not_found_home()}</Link>
        </li>
        <li>
          <a href="/#pricing">{m.common_nav_pricing()}</a>
        </li>
      </ul>
    </section>
  );
}

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Layout() {
  const config = Route.useLoaderData();
  const auth = authClient(config.googleClientId);
  const session = auth.useSession();
  const user = session.data?.user;
  const credits = useCreditBalance(session.isPending ? undefined : (user?.id ?? null));
  const balanceText =
    credits.status === 'ready' && credits.available !== null
      ? `${m.home_balance_available({ credits: Math.max(0, credits.available).toLocaleString() })}${credits.available < 0 ? `, ${m.home_balance_debt({ amount: (-credits.available).toLocaleString() })}` : ''}`
      : undefined;

  useEffect(() => {
    captureAttribution();
    flushConfirmedPayment();
  }, []);

  useEffect(() => {
    // Show Google One Tap when signed out; skipped when Google is not configured.
    if (session.isPending || session.data || !config.googleClientId) return;
    promptGoogleOneTap(config.googleClientId);
  }, [session.isPending, session.data, config.googleClientId]);

  return (
    <CreditBalanceContext.Provider value={credits}>
      <div className="page">
        <a className="skip-link" href="#main">
          {m.common_skip_content()}
        </a>
        <header className="site-header">
          <Link to="/" className="brand">
            <span className="brand-symbol" aria-hidden="true">
              <span />
            </span>
            {site.name}
          </Link>
          <nav aria-label={m.common_nav_label()}>
            <Link to="/" className="nav-create">
              {m.common_nav_create()}
            </Link>
            <a href="/#cases" className="nav-examples">
              {m.common_nav_examples()}
            </a>
            <PricingLink source="nav">{m.common_nav_pricing()}</PricingLink>
            <a href="/api-docs" aria-label={m.common_nav_agent_docs()} title={m.common_nav_agent_docs()}>
              API
            </a>
            {import.meta.env.DEV && <LocaleToggle />}
            {user ? (
              <AccountLink
                className="account-entry"
                title={user.email}
                ariaLabel={balanceText ? `${m.common_account_label()}, ${balanceText}` : undefined}
              >
                {credits.status === 'ready' && credits.available !== null && (
                  <span className="header-credit-balance">
                    {Math.max(0, credits.available).toLocaleString()}{' '}
                    <span>{m.common_account_credits()}</span>
                  </span>
                )}
                <span className="avatar" aria-hidden="true">
                  {user.image ? (
                    <img src={user.image} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    (user.name || user.email).slice(0, 1).toUpperCase()
                  )}
                </span>
              </AccountLink>
            ) : (
              <a
                href="/login"
                className="sign-in-link"
                onClick={(e) => {
                  e.preventDefault();
                  openSignIn();
                }}
              >
                {m.common_nav_sign_in()}
              </a>
            )}
          </nav>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="site-footer">
          <span>{m.common_footer_notice({ year: new Date().getFullYear(), name: site.name })}</span>
          <nav aria-label={m.common_footer_label()}>
            <a href="/#faq">{m.common_footer_faq()}</a>
            {/* Trend guide pages: site-wide internal links keep fresh meme pages crawlable beyond sitemap-only discovery. */}
            <Link to="/shoulder-carry-ai">{m.common_footer_shoulder()}</Link>
            <Link to="/tough-like-a-gorilla-ai">{m.common_footer_gorilla()}</Link>
            <Link to="/jisoo-addicted-dance-ai">{m.common_footer_jisoo()}</Link>
            <Link to="/christmas-pajama-dance-ai">{m.common_footer_xmaspajama()}</Link>
            <Link to="/housewife-dance-ai">{m.common_footer_housewife()}</Link>
            <Link to="/i-need-a-girl-dance-ai">{m.common_footer_needagirl()}</Link>
            <Link to="/ice-ice-baby-dance-ai">{m.common_footer_iceicebaby()}</Link>
            <Link to="/i-thought-we-were-having-a-nice-date-ai">{m.common_footer_nicedate()}</Link>
            <Link to="/w-chews-l-nibbles">{m.common_footer_wchews()}</Link>
            <Link to="/frutiger-aero-yams">{m.common_footer_frutigerayams()}</Link>
            <Link to="/fancy-cafe-ai">{m.common_footer_fancycafe()}</Link>
            <Link to="/red-carpet-ai">{m.common_footer_redcarpet()}</Link>
            <Link to="/mulmannan-gwangeo-ai">{m.common_footer_mulmannan()}</Link>
            <Link to="/when-two-legends-try-to-make-coffee">{m.common_footer_coffeelegends()}</Link>
            <Link to="/paws-at-you-ai">{m.common_footer_paws()}</Link>
            <Link to="/bicep-heart-ai">{m.common_footer_bicep()}</Link>
            <Link to="/epic-dunk-ai">{m.common_footer_epicdunk()}</Link>
            <Link to="/burning-bridges-ai">{m.common_footer_burningbridges()}</Link>
            <Link to="/tiptoeing-in-my-jordans-ai">{m.common_footer_tiptoejordans()}</Link>
            <Link to="/buggin-dance-ai">{m.common_footer_buggindance()}</Link>
            <Link to="/dog-elevator-prank-ai">{m.common_footer_dogelevator()}</Link>
            <Link to="/chipmunks-dance-ai">{m.common_footer_chipmunks()}</Link>
            <Link to="/anime-star-eye-ai">{m.common_footer_animestareye()}</Link>
            <Link to="/can-i-ride-dance-ai">{m.common_footer_canride()}</Link>
            <Link to="/ba-ba-ba-dance-ai">{m.common_footer_bababa()}</Link>
            <Link to="/birthday-car-ai">{m.common_footer_bdaycar()}</Link>
            <Link to="/dog-bohemian-rhapsody-ai">{m.common_footer_dogrhapsody()}</Link>
            <Link to="/fish-cutting-meme-ai">{m.common_footer_fishcut()}</Link>
            <Link to="/pimpwalk-entrance-ai">{m.common_footer_pimpwalk()}</Link>
            <Link to="/flamingo-float-ai">{m.common_footer_flamingofloat()}</Link>
            <Link to="/snatch-back-splash-ai">{m.common_footer_snatchback()}</Link>
            <Link to="/tears-falling-down-filter-ai">{m.common_footer_tearsfall()}</Link>
            <Link to="/dog-couple-dance-ai">{m.common_footer_dogcouple()}</Link>
            <Link to="/i-love-the-smiths-ai">{m.common_footer_smiths()}</Link>
            <Link to="/christmas-lights-wife-ai">{m.common_footer_xmaslights()}</Link>
            <Link to="/i-want-wings-ai">{m.common_footer_wantwings()}</Link>
            <Link to="/its-my-life-dog-ai">{m.common_footer_itslifedog()}</Link>
            <Link to="/car-alarm-ai-dance">{m.common_footer_caralarm()}</Link>
            <Link to="/earth-zoom-out-video-generator">{m.common_footer_earthzoom()}</Link>
            <Link to="/tung-tung-tung-sahur-ai">{m.common_footer_tung_tung_sahur()}</Link>
            <Link to="/bulin-47-ai">{m.common_footer_bulin()}</Link>
            <Link to="/ozil-goal-ai">{m.common_footer_ozil_goal()}</Link>
            <Link to="/raindance-ai">{m.common_footer_raindance()}</Link>
            <Link to="/smalltown-boy-ai">{m.common_footer_smalltown_boy()}</Link>
            <Link to="/alors-on-danse-ai">{m.common_footer_alors_on_danse()}</Link>
            <Link to="/cheba-man-dance-ai">{m.common_footer_cheba_man()}</Link>
            <Link to="/tiny-desk-ai">{m.common_footer_tiny_desk()}</Link>
            <Link to="/venom-makeup-ai">{m.common_footer_venom_makeup()}</Link>
            <Link to="/what-stop-sign-ai">{m.common_footer_what_stop_sign()}</Link>
            <Link to="/hotel-lobby-ai">{m.common_footer_hotel_lobby()}</Link>
            <Link to="/58th-floor-ai">{m.common_footer_fifty_eighth_floor()}</Link>
            <Link to="/crazy-frog-ai">{m.common_footer_crazy_frog()}</Link>
            <Link to="/spooky-scary-skeletons-ai">{m.common_footer_skeleton_dance()}</Link>
            <Link to="/closing-door-prank-ai">{m.common_footer_door_prank()}</Link>
            <Link to="/snow-leopard-meme-ai">{m.common_footer_snow_leopard()}</Link>
            <Link to="/kda-firestarter-ai">{m.common_footer_firestarter()}</Link>
            <Link to="/like-jennie-ai">{m.common_footer_like_jennie()}</Link>
            <Link to="/katseye-animal-ai">{m.common_footer_animal_dance()}</Link>
            <Link to="/chiikawa-dancing-nokia-ai">{m.common_footer_nokia_dance()}</Link>
            <Link to="/privacy">{m.common_footer_privacy()}</Link>
            <Link to="/terms">{m.common_footer_terms()}</Link>
            <Link to="/refunds">{m.common_footer_refunds()}</Link>
            <Link to="/dmca">{m.common_footer_dmca()}</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{m.common_footer_contact()}</a>
          </nav>
        </footer>
        <SignInDialog />
        <PricingDialog />
        <AccountDialog />
      </div>
    </CreditBalanceContext.Provider>
  );
}

// For local review: the header globe toggles en/zh (sets a cookie and reloads). Production is English only; DEV is false in builds so this never renders.
// Dev-only, so styles are inline rather than in styles.css.
function LocaleToggle() {
  const zh = getLocale() === 'zh';
  const label = zh ? m.common_locale_to_en() : m.common_locale_to_zh();
  return (
    <button
      type="button"
      className="locale-toggle"
      aria-label={label}
      title={label}
      onClick={() => setLocale(zh ? 'en' : 'zh')}
      style={{ padding: '0.2rem 0.6rem', borderRadius: 999, font: '600 13px/1.6 monospace' }}
    >
      {zh ? 'ZH' : 'EN'}
    </button>
  );
}
