# Turnstile generation compatibility

`CoreEnv` accepts optional `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
`useGeneration` accepts an optional `turnstileSiteKey`; existing reCAPTCHA callers remain valid.
Turnstile takes precedence when supplied, and its response uses the established `recaptchaToken` request field.
The page renders `#turnstile-slot` for an interactive challenge.
Site-specific trial handlers validate tokens before reserving any allowance or dispatching a job.
The compatibility change does not alter credit settlement, guest quota policy, email delivery or Workflow execution.

Siteverify responses must have a successful HTTP status and the literal boolean `success: true`.
Missing inputs, malformed responses and transport failures are rejected before trial reservation.
Siteverify has a 10-second request deadline and does not retry single-use tokens automatically.
The browser limits script loading to 15 seconds and each challenge to 45 seconds;
failed script loads can retry, and completed or failed widgets are removed by ID.

The helper does not add hostname or action restrictions; a caller that needs those checks
must supply trusted deployment expectations and validate the corresponding Siteverify fields.
A successful mocked response proves the code path, not production widget configuration.
