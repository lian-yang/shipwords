/** Prevent automatic analytics page views from sending the checkout order URL. */
export function guardAnalyticsScripts(scripts: Record<string, unknown>[]) {
  return scripts.map((script) => ({
    children:
      `if(location.pathname!=="/billing/return"){` +
      (typeof script.src === 'string'
        ? `var s=document.createElement("script");s.src=${JSON.stringify(script.src)};s.async=true;document.head.appendChild(s);`
        : String(script.children ?? '').replace(
            'function gtag(){dataLayer.push(arguments)}',
            'window.gtag=function(){window.dataLayer.push(arguments)};',
          )) +
      '}',
  }));
}
