# Free AI Video — Daylight studio

## Intent
A clear creative workbench where a written idea and a cinematic image sit together. The first task is making a short video, so the composer stays in the first viewport. The image supplies imagination; the interface supplies clarity.

- Audience: English-speaking creators trying text-to-video or animating one reference photo, on desktop and mobile.
- Main action: describe a scene, optionally attach an image, choose the frame, generate, then download.
- Tone: approachable, precise, lightly editorial. No invented testimonials, usage totals, or output claims.
- Reference: Pika's current homepage (`design/ui-redesign/reference-pika.png`) makes imagery the strongest element. Borrow its image confidence while keeping an immediately usable composer. Luma's reference is archived alongside it when accessible.

## Visual direction
- Canvas #f7f8f2, white working surface, ink #20251f, muted ink #62685e, quiet borders #dce1d6.
- Lime #c8ed7a marks the main action and selected affordances. Soft green #eff3e8 groups secondary controls. Orange/teal artwork supplies contrast.
- Arial/system sans, tight display tracking, 48–56px desktop H1, 32–38px mobile H1, 15–17px body, minimum 13px supporting text. Tabular numbers.
- Desktop: full-width heading above a two-part workspace, composer and image at equal visual weight. Mobile: composer first, then inspiration. No horizontal scrolling.
- Buttons have 10px corners, panels 18–22px, thin borders and clear focus rings. Native selects remain accessible. Primary action is a wide lime button; reading links are underlined.
- Brand mark: two offset frames and a play triangle, simple geometry tied to moving pictures.

## Structure and content
Retain one H1 and its original keyword, metadata, canonical, OG image and WebApplication schema. Preserve section order: generator, real video examples, how it works, limits, pricing. Add FAQ after pricing, with visible answers and matching FAQPage data from one source. Preserve #tool, #results, #cases, #limits, #pricing, all existing routes and policy links. Correct leftover image-generator wording in llms.txt.

Real examples keep their clips, posters and prompts. Newly generated planet artwork is prompt inspiration with a button that inserts its prompt; it is not presented as an actual video output. Compact reassurance replaces repeated sales copy; factual limits and refund distinctions remain visible.

Admin (/admin, noindex) is an internal utility page behind the ADMIN_EMAIL gate, written in Chinese regardless of the site locale: plain white cards and bordered tables with tabular numbers, none of the marketing styling. It is not linked from the site.

## Motion and states
Motion feels like a scene settling into a frame: short and controlled. A 350ms workspace entrance, 150ms button feedback, 220ms dialog entrance, and a subtle pending render indicator. FAQ uses native disclosure. Reduced motion removes transforms and automatic clip playback. This is a tool page, so no scroll hijacking or pinned stage.

Keep existing pending, error, insufficient-credit, sign-in, upload, returning-user and checkout-return behaviors. Prompt, model, frame and reference paths continue to persist through the existing sessionStorage mechanism. Native video controls and pause remain available for real examples.

## Verification
Desktop 1440×900, phone 390×844 and 200% reading. Validate prompt insertion and reload persistence, frame options, FAQ disclosure, pricing and sign-in dialogs, policy/landing navigation, reduced motion and overflow. No paid generation or checkout in visual verification. Evidence, direction studies, prompt provenance and independent visual review live in design/ui-redesign/.

## Trial and paid generation choices
Keep the existing daylight studio palette and section order. Add a labelled native generation-mode selector within the composer so daily trials, registration vouchers and paid renders show their specifications and cost before submission. Free modes never switch to a paid mode automatically. Show voucher availability and expiry separately from the credit balance. Pricing cards show credit totals because video cost varies by model and specifications; arrange all three packs responsively without suggesting that Studio is cheaper per credit than Creator. Use existing muted text and lime accents for these additions.

Give the account dialog more reading room on desktop while keeping its existing phone width and spacing. Long account details, including email addresses, must wrap within the dialog at phone widths.

The account is a compact workspace: place credits and the registration trial side by side on desktop, with results and orders as quiet secondary sections. Group agent access, the setup-prompt copy action and API key management together; stack everything on narrow screens. Keep the existing dialog entrance and button feedback, with reduced-motion behavior unchanged. The main navigation links directly to the agent integration guide on desktop and mobile.

## Credit balance and purchase guidance
Show a signed-in customer's available credit balance beside the account entry and next to the paid generator's cost. Treat it as a refreshable snapshot: loading or failed reads must never appear as a zero balance or replace the server's final credit check. When a known balance is below the selected cost, show the shortfall and a clear link to the existing credit packs; if one pack cannot cover the shortfall, say that multiple purchases may be needed. When free allowance is exhausted, offer an explicit switch to credit generation without starting a job or spending credits. Keep free trials, balance and purchase choices distinct; preserve the current layout, native controls and quiet green palette on narrow screens.
