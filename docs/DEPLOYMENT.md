# Deployment checklist

1. **Supabase**: create project → copy URL, anon key, JWT secret. Set Site URL and redirect URLs to your frontend origin.
2. **Backend** (any container host: Render, Fly, Railway, Cloud Run): build `backend/Dockerfile`; set `DATABASE_URL` (Postgres), `CORS_ORIGINS` (exact frontend origin), `SUPABASE_JWT_SECRET`, `APP_ENV=production`, `TRUST_PROXY=1` if behind a proxy, LLM variables. **One instance/worker.** Health: `/health`, readiness: `/health/ready`.
3. **Frontend** (Vercel or container): set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` **at build time**. The CSP in `next.config.mjs` only allows the API and Supabase origins — update if you add others.
4. **HTTPS is required** for microphone access (except localhost).
5. **Admin**: set `app_metadata.role = "admin"` on your user in Supabase.
6. **Smoke test**: `python -m app.tools.check_llm`, sign up, run one interview end to end, open the report, download the PDF.
7. **Before public launch**: have counsel review `/privacy` and `/terms`; fill in the contact email; have domain experts spot-check the question bank; rotate any API key that was ever pasted into chat or committed; set provider budget alerts.
8. **Backups**: enable Postgres backups; deleted-user data is hard-deleted, only anonymous `usage_events` counters persist.
