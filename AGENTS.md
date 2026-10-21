<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Contact logic (phone parsing, validation, duplicates, WhatsApp URLs, export, spreadsheet mapping, call follow-up) lives as pure modules in `src/lib/contacts/` with tests in `src/test/contacts.test.ts` — keeps it testable without a browser.
- App data is read/written from the browser Supabase client under RLS (`user_id = auth.uid()` on every table); only AI extraction and account deletion use server functions — keeps keys server-side with minimal backend surface.
- AI extraction runs in `src/lib/ai/extract.server.ts` via the Lovable AI Gateway (Responses API, structured output); model overridable with `CONTACT_EXTRACTION_MODEL` — deterministic regex parsing always runs alongside to drop invented numbers/emails and recover missed ones.
- Spreadsheets are parsed client-side with column mapping (no AI); images/PDFs go to the AI as files; DOCX is converted to text in the browser first — large sheets stay fast and cheap.
- Uploaded files are never stored; they are processed in memory only — privacy by default.
- Call follow-up is a return-from-dialer prompt (localStorage context + visibility/Capacitor appStateChange), never claimed as call-completion detection — browsers cannot see call state.
- tsconfig keeps strict flags except `noImplicitReturns` (off) — React effects/handlers commonly return early.
