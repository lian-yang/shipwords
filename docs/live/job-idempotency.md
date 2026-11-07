# Optional job request idempotency

The jobs handler accepts an optional trusted `JobIdempotency` on `create`. Sites bind it to an authenticated user and a client request key. `lookup` returns the existing job ID and whether the request fingerprint matches; `insert(jobId)` supplies an unexecuted D1 statement to record the association in the same batch as the job and credit charge. A uniqueness constraint on the site's association table is required.

Matching replays return the original owned job without dispatching again; conflicting payloads return 409. The handler rechecks the association after write failures to resolve concurrent requests, including a balance check that races the original charge. It never trusts the association to grant access to another user's job. Sites must authenticate and normalize/fingerprint request contents before constructing the hooks. Existing browser calls omit the hooks and retain their current behavior.

The job transaction and workflow dispatch are separate operations. A worker interruption after the transaction and before dispatch can leave a queued job for stale-job settlement; replay does not dispatch it again.
