# Benefits studio: go-live checklist

Work lives on branch `feat/benefits-studio` (Sites) and, for the app, a separate branch in BISO-Flutter. Nothing in this list has been run against production yet. Every step that writes to production is yours.

Follow the order. Each stage's steps assume the previous ones are done.

## Stage 1: schema and migration

1. **Back up `campus_benefits`.** In the Appwrite Console (Databases → app → Benefits → Export), export it as CSV. The dry-run plan does not contain descriptions, so this export is the only copy of them if anything goes wrong.
2. **Push the schema before merging anything.** Run `cd packages/api && appwrite push tables`.
   - The change makes five columns of `campus_benefits` optional: `kind`, `redemption_type` (with default `none`), `category`, `description_nb` and `description_en`. It also adds `section` and an index, the tables `benefit_codes` and `membership_texts`, and `partners.sort_order`.
   - **If the CLI offers to recreate or delete any existing column, abort.** Recreating wipes that column on every row. Instead, change those five columns by hand in the Console (untick "required"; set the `redemption_type` default to `none`), then push again for the rest.
   - The change is additive. Today's admin and website keep working after it.
3. **Then merge and deploy the website.** The member portal now queries the `section` column. Deployed before the push, it would show an empty list.
4. **Review the migration.**
   - Run `cd packages/shared && bun run migrate:benefits`. This is a dry run and only reads.
   - Open `.superpowers/benefits-migration/review.md`.
   - **Copy `plan.json` to `plan-approved.json` before editing**, because every dry run overwrites `plan.json`.
   - Handle every note in the review:
     - **"Mulig duplikat: … id …"** means the line looks like an existing benefit. To merge, set the line's `action` to `"merge"` and `mergeInto` to that id. To keep both, do nothing.
     - **"Samme tilbud finnes på … vurder å gjøre det nasjonalt"** means the same deal exists on several campuses. Set `campusId` to `"5"` on one line and `action` to `"skip"` on the others. The existing local benefit it refers to stays, so delete it afterwards in the new admin, or the deal shows twice on that campus.
     - **A line that merges into two rows** (for example Trondheim's Karrieredagene line) keeps both rows, so nothing is lost. Trim `mergeInto` if you prefer.
     - **"Finnes også som lokal fordel på …"** means a national line also exists as a local benefit. Delete or merge the local one later in the new admin.
     - **Partners marked "(forslag)"** were guessed from the benefit titles. Fix the `name` or remove the `partnerKey`.
   - Trim Trondheim's "Karrieredagene Trondheim – …" `mergeInto` down to the Karrieredagene row alone. The second target, "Bedriftspresentasjoner", is a false match. It does no harm, but it's misleading.
   - Some near-duplicates aren't flagged because their wording is too different. Check these yourself and merge them by hand:
     - Oslo "Medlemspriser på BISO Oslos arrangementer gjennom hele året" vs national "Bedre priser på BISO-arrangementer"
     - Oslo's and Trondheim's "Bli med i undergrupper …" vs national "Verv og undergrupper"
   - Two existing benefits carry a code. Before deleting either of them in the new admin, for example after making Rekom or Econa national, copy its code to the benefit that replaces it.
   - Check that Trondheim's "Rabatt på billett til Fadderullan" really is 40 %. It merges into the national "40% rabatt på Fadderullan".
   - The draft titled "los t" is proposed for deletion. Set `"approved": true` if you want it deleted.
   - The apply step replaces each published benefit's permissions with `read("any")`. That's correct for today's rows, which only carry `read("team:biso-members")`.
5. **Apply.** Run `cd packages/shared && bun run migrate:benefits --apply --plan ../../.superpowers/benefits-migration/plan-approved.json`.
   - If it stops halfway, fix the cause and run the same command again. It picks up where it left off.
   - Don't re-run it after editors have started changing benefits in the new admin. A re-run resets the created rows to the plan's text and status.
6. **Until stage 2 is live, don't edit benefits in the old admin.** The old editor can't handle the new one-line benefits, and it writes codes only to the old column.

## Stage 2: admin board and panel

1. **Run stage 1 first.** The schema push and the migration apply must both happen before you deploy this admin. The new admin relies on the `section` column. Until the migration has linked each benefit to its partner, the new admin can't show or keep the free-text partner names on today's website correctly.
2. **Give the Branding Committee leader access.**
   - Ask the leader to sign in to admin once with Microsoft, so their account exists.
   - In the Appwrite Console (Auth → that user → Identities), copy the Microsoft identity's **provider email**. It's usually the person's Microsoft sign-in name. An alias such as `pr@biso.no` only works if it *is* that sign-in name.
   - Set `BENEFITS_EDITOR_EMAILS=<that address>` in the admin app's environment and redeploy. Several addresses can be listed, separated by commas.
   - The account's own email must match too. That's normally automatic.
   - Check that the Microsoft sign-in provider in Appwrite is limited to the BISO tenant. Only BISO accounts should be able to sign in this way.
3. **Expect these access changes when you deploy:**
   - Campus admins (the `Ledelsen <campus>` groups) manage their own campus and see the national benefits read-only.
   - Global admins and the listed editors manage every campus and the national benefits.
   - **Department members no longer see Fordeler.**
4. **Smoke test after deploying.** In the new admin, hide a test benefit ("Skjul fra nettsiden"). In the Console, check that the benefit and its translation rows have empty permissions. Publish it again and check that they get `read("any")`.
5. **Old free-text partner names stay for now.** A benefit whose partner was only typed as text (from before the migration) keeps that name on today's website, and the panel can't remove it until stage 4.
6. **Codes stay in the public columns until stage 4.** Codes and partner names are still also written to the old public columns, the same as today, because the website still reads them there. Ship stage 4 soon after.
