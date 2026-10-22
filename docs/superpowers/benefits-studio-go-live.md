# Benefits studio: go-live checklist

Work lives on branch `feat/benefits-studio` (Sites) and, for the app, a separate branch in BISO-Flutter. Nothing in this list has been run against production yet. Every step that writes to production is yours.

The release runbook below is the only order to follow. It ships stages 1 to 4 in one release. The stage sections after it are reference: what each change does, what to expect and what to look out for. Each one points back to the runbook step where it happens.

## Release runbook

Do these top to bottom. Each step assumes the ones before it are done. Steps 5 to 7 belong in one sitting.

1. Back up `campus_benefits`. In the Appwrite Console (Databases → app → Benefits → Export), export it as CSV. It's the only copy of the descriptions if anything goes wrong (stage 1, item 1).

2. Check the settings. Set these before step 6, so the deploy builds with them.
   - `CRON_SECRET` must have the **same value in web, admin and apps/api**. Admin already uses it for calls to apps/api, so look at what it is today and copy that value into web. Don't invent a new one.
   - `NEXT_PUBLIC_WEB_BASE_URL` in admin: the public website address, for example `https://biso.no`. A trailing slash is fine.
   - `BENEFITS_EDITOR_EMAILS` in admin: the Branding Committee leader's Microsoft provider email. Stage 2, item 2 says how to find it.
   - If `CRON_SECRET` or `NEXT_PUBLIC_WEB_BASE_URL` is wrong or missing, saves in admin still work. The website just catches up later (stage 4, item 1).

3. Push the schema, keeping the table-level read on `campus_benefits`.
   - In `packages/api/appwrite.config.json`, set `campus_benefits` `"$permissions"` to `["read(\"any\")"]`. The file in git has none, but today's website still reads benefits through it.
   - From `packages/api`, run `appwrite push tables`.
   - **If the CLI offers to recreate or delete any existing column, abort.** Recreating wipes that column on every row. Instead, change the five columns by hand in the Console (untick "required" on `kind`, `redemption_type`, `category`, `description_nb` and `description_en`; set the `redemption_type` default to `none`), then push again for the rest.
   - When the push is done, restore the file: `git checkout -- packages/api/appwrite.config.json`.
   - The push is additive. Today's admin and website keep working after it. What it changes: stage 1, item 2.

4. Dry run and review the migration. It only reads, so you can do this days ahead.
   - From `packages/shared`, run `bun run migrate:benefits`.
   - Open `.superpowers/benefits-migration/review.md`.
   - **Copy `plan.json` to `plan-approved.json` before editing**, because every dry run overwrites `plan.json`.
   - Handle every note as stage 1, item 4 describes, editing `plan-approved.json`.
   - The plan is a snapshot. If benefits are added or changed in the old admin after your dry run, run it again before step 5, copy the new `plan.json` and redo your edits.

5. Apply the migration. From `packages/shared`, run `bun run migrate:benefits --apply --plan ../../.superpowers/benefits-migration/plan-approved.json`.
   - If it stops halfway, fix the cause and run the same command again. It picks up where it left off. Re-running is only safe until editors start using the new admin (stage 1, item 5).
   - **From now on, don't edit benefits in the old admin.** It can't handle the new one-line benefits, and it writes codes only to the old column.
   - Go straight on to step 6. Until then, today's member portal (`/member`) shows the new one-line benefits (career, social, safety, business) as member cards, because it doesn't filter by section. That's only cosmetic, but keep the gap to minutes.

6. Deploy right after step 5. Deploy these together:
   - web
   - admin
   - apps/api. The app reads benefits through it (`GET /api/benefits` and `POST /api/benefits/<id>/reveal`). It reads the new table, so it goes out after the migration (step 5), like the others.

   **Don't deploy admin alone, and don't deploy web before step 5.** Why: stage 4, item 2 and stage 1, item 3. If merging the branch into `main` deploys these by itself, that merge is this step, so don't merge before step 5. Later stages that join this release add their apps to this list.

   Expect the access changes in stage 2, item 3.

7. Clear the old codes from the public column, in the same session as the deploy. Pick a quiet moment, when nobody is editing benefits: the script plans from a snapshot. From `packages/shared`:
   - Dry run: `bun run clear:legacy-benefit-codes`. It only reads and prints `copy:` and `clear:` counts. Expect `clear:` to be small (about 2). `copy: 0` means the migration already copied those codes to `benefit_codes`.
   - Then write: `bun run clear:legacy-benefit-codes --apply`. It copies each remaining code into `benefit_codes` and empties `campus_benefits.redemption_value`.
   - Not before step 6: today's website reads codes from that column.

8. Spot check, then push the schema again.
   - In the Console, open one or two published benefits and check that each row itself has `read("any")` in its permissions. **After this push, a published row without it disappears from the website.**
   - This push uses the file as it is in git. `git diff packages/api/appwrite.config.json` must show nothing.
   - From `packages/api`, run `appwrite push tables`. It removes the table-level read on `campus_benefits`, so rows can only be read through their own permissions.
   - **If the CLI offers to recreate or delete any existing column, abort.** Recreating wipes that column on every row.

9. Checks. Later stages add their checks to this list.
   - What a visitor gets from Appwrite directly, with no session. Take the endpoint and project from web's `NEXT_PUBLIC_APPWRITE_ENDPOINT` and `NEXT_PUBLIC_APPWRITE_PROJECT`; the values below are the defaults in the code.

     ```sh
     ENDPOINT=https://appwrite.biso.no/v1
     PROJECT=biso
     curl -s -G "$ENDPOINT/tablesdb/app/tables/campus_benefits/rows" \
       -H "X-Appwrite-Project: $PROJECT" \
       --data-urlencode 'queries[0]={"method":"limit","values":[500]}' \
       --data-urlencode 'queries[1]={"method":"select","values":["status","redemption_value"]}' \
       -o guest-benefits.json
     grep -o '"status":"[a-z]*"' guest-benefits.json | sort | uniq -c
     grep -oE '"redemption_value":"[^"]+"' guest-benefits.json
     ```

     The first `grep` must print one line, `"status":"published"`, with the number of published benefits in front. A `draft` or `archived` line means hidden benefits are public. If it prints nothing, open the file: an error or an empty `rows` list means visitors can't read the published benefits, so the website shows none either. The second `grep` must print nothing; any line it prints is a code anyone can read. Also compare the number of rows the `curl` returned (the `total` in `guest-benefits.json`) with the number of published benefits in the Console (filter `status = published`). If the guest sees fewer, some published row is missing `read("any")`: republish it from the new admin by opening it and pressing "Publiser". Delete `guest-benefits.json` afterwards.
   - A draft can't be read by its ID. In the Console, copy the ID of a benefit with status `draft`. If there is none, save one in admin with "Lagre utkast" and delete it when you're done. Then, in the same terminal:

     ```sh
     curl -s -o /dev/null -w "%{http_code}\n" \
       "$ENDPOINT/tablesdb/app/tables/campus_benefits/rows/<draft id>" \
       -H "X-Appwrite-Project: $PROJECT"
     ```

     Expect `404` (`401` is fine too). `200` means drafts are public.
   - Log out. Open view-source for `/member`, `/campus`, `/students` and `/membership` and search for a code you know. It must not be there.
   - Sign in with an account that has no active membership, open the member portal and press "Vis kode" on a benefit. It should say: "Du trenger et aktivt medlemskap for å se denne fordelen. Bli medlem i BISO for å låse den opp." If it says "Vi klarte ikke å sjekke medlemskapet ditt akkurat nå. Prøv igjen om litt." instead, that's an outage message, not the answer you're testing for. Try again later.
   - In admin, save a small change to a published benefit. It should show on the website on the next reload. If the website runs on more than one instance, only the instance that received admin's call refreshes straight away. The others catch up within a minute or two, because their cache refreshes every minute. A second view that lags like that is expected, not a bug.
   - Open `/campus`, then "For bedrifter". The campus's partner logos should show.
   - The admin smoke test in stage 2, item 4.
   - Membership texts (stage 6). In admin, open Fordeler, then "Tekster". Change one line in "Forsiden – «Bli med»" and save. Reload the website's home page: the changed line shows. Press "Tilbakestill til standard": the original text is back on the website. Sign in as a campus admin who is neither a global admin nor a benefits editor: "Tekster" must not show.
   - The app (after step 11 is released). As a member, open the member pass, then "Dine fordeler", then a deal with a code. "Vis kode" must show the code.
   - As a non-member, "Dine fordeler" still lists the deals. Tap a deal with a code or a link: the sheet says "Koden vises bare for medlemmer." with a "Bli medlem" button, and no code or link shows.
   - Open the campus screen. The five benefit sections show, in Norwegian.

10. Retire the old admin. From step 8 on, never use the old admin again, and don't roll admin back to an earlier deployment. It publishes benefits with only `read("team:biso-members")`, which the new website can't read, so such a benefit vanishes from the site.

11. App release. After the deploy (step 6) and the checks (step 9), merge `feat/benefits-in-app` into BISO-Flutter `main` and ship a release as usual.
   - It can ship any time after apps/api is deployed. Before that, the new sections simply stay hidden: the app hides them when `GET /api/benefits` answers 404.
   - **Old app versions keep reading the old `campus_data` benefit texts on the campus screen** (they don't know the new table) and have no "Dine fordeler". So don't delete or blank the `campus_data` benefit columns until most users have updated. The repo has no minimum-version mechanism in `apps/api` to force it.
   - The app checks are in step 9.

## Stage 1: schema and migration

1. Backup (runbook step 1). The dry-run plan does not contain descriptions, so the CSV export is the only copy of them if anything goes wrong.
2. First schema push (runbook step 3).
   - The change makes five columns of `campus_benefits` optional: `kind`, `redemption_type` (with default `none`), `category`, `description_nb` and `description_en`. It also adds `section` and an index, the tables `benefit_codes` and `membership_texts`, `partners.sort_order` and the stage 3 `partners` index.
   - The table-level read on `campus_benefits` stays for this push because today's website depends on it. The second push (runbook step 8) removes it.
3. Why the website waits for the migration (runbook steps 5 and 6). The new website reads benefits only from the new table. Deployed before the schema push, its member portal would show an empty list, because it queries the `section` column. Deployed before the migration, `/campus` ("For studenter"), `/students` and `/membership` would show no career, social, safety or business sections, because the migration creates those one-line benefits.
4. Reviewing the migration (runbook step 4).
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
5. Applying (runbook step 5). Don't re-run the apply after editors have started changing benefits in the new admin. A re-run resets the created rows to the plan's text and status.
6. The old admin (runbook steps 5 and 10). The old editor can't handle the new one-line benefits, and it writes codes only to the old column, so it must not be used for benefits once the migration is applied.

## Stage 2: admin board and panel

1. Deployed in runbook step 6, after the migration (step 5). The new admin relies on the `section` column. It also no longer reads free-text partner names: until the migration has turned them into partners and linked each benefit, an editor save would drop the name, and the migration could no longer create that partner.
2. Give the Branding Committee leader access.
   - Ask the leader to sign in to admin once with Microsoft, so their account exists. This can be done before the release.
   - In the Appwrite Console (Auth → that user → Identities), copy the Microsoft identity's **provider email**. It's usually the person's Microsoft sign-in name. An alias such as `pr@biso.no` only works if it *is* that sign-in name.
   - Set `BENEFITS_EDITOR_EMAILS=<that address>` in the admin app's environment (runbook step 2). Several addresses can be listed, separated by commas. If you change it after the release, redeploy admin.
   - The account's own email must match too. That's normally automatic.
   - Check that the Microsoft sign-in provider in Appwrite is limited to the BISO tenant. Only BISO accounts should be able to sign in this way.
3. Expect these access changes when you deploy:
   - Campus admins (the `Ledelsen <campus>` groups) manage their own campus and see the national benefits read-only.
   - Global admins and the listed editors manage every campus and the national benefits.
   - **Department members no longer see Fordeler.**
4. Smoke test (runbook step 9). In the new admin, hide a test benefit ("Skjul fra nettsiden"). In the Console, check that the benefit and its translation rows have empty permissions. Publish it again and check that they get `read("any")`.
5. Partner names and codes. Because web and admin ship together with stage 4, the admin keeps partners only as `partner_id` and codes only in `benefit_codes`. Every save leaves the old public columns (`partner_name`, `partner_logo_url`, `redemption_value`) empty.

## Stage 3: partners page

1. Schema: the `partners` index (`idx_level_campus_sort`), which lets logos be filtered and sorted, goes out with the first push (runbook step 3).
2. Deployed with admin in runbook step 6. The partners page replaces the old read-only list with the "API Beta" badge.
3. Logos. Because stage 4's website ships in the same deploy, logos added or reordered here show on the home page, "Om oss" and in partner blocks in their new order soon after a save.
4. Ending vs deleting a partner. Ending a partner hides its offers straight away. Restarting brings back exactly the offers that were live. "Slett for godt" deletes the partner, its offers and their codes, and that can't be undone.

## Stage 4: the website switch

Stage 4 makes the website read benefits from the new table and hands out codes only to active members. It also makes admin saves show up on the website quickly.

1. Secrets (runbook step 2). Admin tells the website about a save with a call to `NEXT_PUBLIC_WEB_BASE_URL` that carries `CRON_SECRET`. If either is wrong or missing, saves in admin still work. The website just catches up within a few minutes instead of at the next page view. That's not a broken save.
2. Web and admin go out together (runbook step 6). Today's website would lose codes and partner names on any benefit edited in the new admin, because the new admin no longer writes them to the old columns.
3. Clearing the old codes (runbook step 7). The migration copies codes to `benefit_codes` but leaves them in the public `campus_benefits.redemption_value` column too. The clear script empties that column, after copying any code `benefit_codes` doesn't have yet (it never overwrites one that's there). It only prints counts, never a code, and it's safe to re-run.
4. Second schema push (runbook step 8). After it, `campus_benefits` rows can only be read through their own permissions. The new admin gives published rows `read("any")`, and drafts and hidden rows none.
5. Old text lists are gone. The old `campus_data` text arrays are no longer shown anywhere on the website. Benefits come only from the new table.

## Stage 6: membership texts

The page "Tekster om medlemskap" (`/benefits/texts`, link "Tekster" in the header of the benefits board) lets global admins and benefits editors edit seven bullet lists about membership: home "Bli med", the membership cards in the member portal, the portal's locked-content list, onboarding, the shop's member box, `/business` and Business Hotspot.

1. Nothing to migrate. The `membership_texts` table came with the first schema push (runbook step 3).
2. It works once the deploy (runbook step 6) is done. The website reads the texts from `membership_texts` and refreshes them when someone saves.
3. Every spot shows today's built-in text until someone saves it. A spot that was never saved, or a failed read, also shows the built-in text.
4. English is translated automatically when the English line is left blank. "Tilbakestill til standard" brings back the built-in text.
5. Prices in the shop and portal copy can't be edited here. That is on purpose.
6. The check is in runbook step 9.
