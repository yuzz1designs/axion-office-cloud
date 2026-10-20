# Session recovery and dashboard refreshes

Protected same-origin API calls recover once after HTTP 401 (or `authRequired` from profile status). Concurrent failures share a token renewal and cookie synchronization; late responses reuse that recovery. Request bodies and abort signals are preserved. Network failures and other status codes never replay mutations. Auth endpoints and external requests are excluded to prevent recursion or credential leakage.

Supabase synchronization runs after auth callbacks release their lock, every minute while visible, and when the connection/tab resumes. Temporary upstream authentication failures return an unavailable response rather than reporting a signed-out user. Background profile refresh errors preserve the existing screen. Explicit sign-out waits for an outstanding cookie synchronization before clearing the cookie.

Dashboard refreshes coalesce realtime bursts, never overlap, stop on unmount and pause in hidden tabs. Only relevant tables trigger dashboard refreshes. Independent data sources retain successful results when another source fails. Second-resolution session counters render independently of the dashboard and editor. Feature screens load on demand.

Validation (controlled fixtures):
- 12 concurrently rejected API requests recovered with one token renewal, preserving an unsaved quote; a temporary profile outage kept the editor open.
- 30 task events: 150 dashboard requests before, 5 after. 30 unrelated note events: 150 before, 0 after.
- Initial JavaScript bundle: 1,618.20 kB before, 634.67 kB after (uncompressed); feature chunks load when opened.
- 200 automated tests passed, including authentication outages, revoked credentials, replayed mutation bodies, aborts and refresh coalescing.

These checks use simulated session failures, not the user's production credentials. They address reproducible failure paths; a future outage still needs its own server/network evidence.
