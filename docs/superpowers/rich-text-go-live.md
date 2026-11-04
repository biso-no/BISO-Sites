# Rich text editor: go-live checklist

Branch `feat/rich-text-editor` (not pushed). The spec and the three "Stage done"
notes are in `docs/superpowers/specs/2026-11-03-rich-text-editor-design.md`.

## Check by hand before deploying

Tests fake focus, the clipboard and screen readers, so these need a real
browser. Use a test page.

1. **Word and Google Docs paste.** Make one document with Heading 1 and 2,
   nested bullets, a numbered list broken by a paragraph, a red word, a link, a
   table with a header row and a merged cell, and a picture. Paste it from Word
   on Mac, Word on Windows (if you have it), Word on the web and Google Docs.
   You should see the headings, nested bullets, the numbered list carry on
   (2., 3.) after the paragraph, the red word in the nearest swatch, the link,
   the table with its header row and merged cell, and the notice "Images aren't pasted into text — use an Image block." for the picture.
2. **Google Docs list-formatted heading.** It pastes as a list item, not a
   heading.
3. **Bubble and link input.** Select a word, check the bubble appears, press
   Cmd/Ctrl+K and type a link. Focus should move into the link input and back.
4. **Canvas look.** List indent, spacing and toolbar match the mockups. Chrome
   should look as before.
5. **Screen readers.** VoiceOver (Safari) and NVDA read a table on biso.no. You
   should hear it as a table with its header cells; note anything odd.
6. **Wide table on a phone.** The table scrolls inside itself and the page does
   not.
7. **Coloured text.** Put one word in each swatch in a text on white, tinted,
   dark and photo sections, under BISO and one department theme. Every colour
   should stay readable.
8. **Expand.** Open it, check the look, then shrink the window to a short height
   and check the toolbar and text are still usable. Esc and Close leave it.
9. **Undo.**
   - Type, pause, type, then Cmd+Z twice and Cmd+Shift+Z. Each burst undoes as one
     step and redo brings it back.
   - Type in the panel, then press Cmd+Z on the canvas. The typing undoes.
   - Ask the copilot to change the text, then press Cmd+Z in the field. The
     copilot change undoes.
10. **Select all in a text that opens with a table.** With the cursor in the
    text below the table, press Cmd+A, then type, paste and press Delete in
    turn. The table is replaced or removed and no text
    is lost off to the side. Pasting only a picture leaves the text alone.
    - Do the same from inside the table: click in a cell and press Cmd+A twice.
      The first selects the table, the second the whole text. Typing, pasting
      and Delete then replace the whole text, not each cell.
11. **The copilot.**
    - Ask it to write a text with a table and a coloured word. It should arrive
      as a real table and colour.
    - Ask it to change a text block that is not selected. It should find it
      and change it.
    - Make a text longer than about 2,000 characters, select another block,
      and ask the copilot to change the last paragraph of the long text. It
      must not cut the text: the end of the text must still be there
      afterwards. Ideally it asks you to select the block. The chat may still
      show ✓ for a change that was refused; that is a known follow-up.
12. **Translate to EN** on a page with a list, a table with a merged cell and
    one word in each colour (Accent, Muted, Green, Amber, Red). The English
    page keeps the list, the table and every colour. Then do the same the other
    way with **Translate to NO**: every colour survives there too.
13. **New unit page.** Create a unit page and open its "About ..." text. It
    should be a formatted text you can edit, with the unit name in it.

## Deploying

- Deploy web **first**, then admin straight after, both from the same commit.
  The new web renders both body shapes. The live web renders an HTML text as
  nothing, so a text saved by the new admin before web ships would show blank.
- No schema change and no `appwrite push`. The body is a field inside the page
  document.
- Existing pages render unchanged. Each text block converts to the new format
  when someone edits it.
- After the deploy, open a few published pages with Rich text and compare them
  with before.
- After the web deploy and then the admin deploy, edit one real Rich text block,
  publish the page, and check the text on biso.no. Pick a block you could
  re-type: if you later roll back, the old site shows that block empty (see
  below).
- The docs pages go out with the next docs deploy.
- The PR docs check still warns about `local-setup.mdx` and `deploying.mdx` (a
  root `package.json` catalog line; both pages checked, still accurate). It also
  warns about `guide/pages-and-news/department-pages.mdx` and
  `developers/reference/events-and-content-sources.mdx`; both checked, still
  accurate.

## Rolling back

Main's text block reads its body with `listOf`, which turns anything that is not
an array into an empty list. So with a new (HTML string) body, the old site
draws nothing and the old editor's text inspector shows an empty list. Editing
that block in the old editor adds a first item and saves an array, which
replaces the HTML text. New HTML bodies come from three places: saving a text in
the new editor, **Opprett side** (Create page) on a unit, whose new template
writes an HTML "About ..." text, and any copilot change to a text.
If none of these has happened yet, rolling back is clean. After that, the old
site and the old editor show those text blocks as empty. The text is still in
the page and shows again when you redeploy. So fix forward. If you must roll
back, roll back web and admin both, and don't edit those pages until you
redeploy.

## Follow-ups (not blocking)

- If a copilot page tool runs in the browser and the browser refuses it, the
  error never reaches the model, and the chat still shows a tick for that call.
  The copilot may then say it made a change it did not. The prompt steers it
  away from the refused case. It was left alone because fixing it reworks a
  working flow.
- A server-side `set_prop` body guard, so that the refusal of a rewrite of a
  long, unselected text reaches the model. Today the browser refuses it and the
  model isn't told.
- When several table cells are selected, a paste fills each one (Plate's own
  multi-cell paste).
- `structure.ts` takes time in the square of the depth on crafted, deeply
  nested pastes.
- Rare undo case: type in a field, then another block changes (the copilot or the
  other surface), then undo in the field. The step back into page undo can bring
  the typing back. A fix needs one shared undo history for fields and page, which
  loses the caret-preserving field undo.
- A sanitiser timing test (150 ms bound) ran 170 ms once under heavy parallel
  load. It could flake in CI; loosen the bound or measure relative time if it does.
- Page redo by keyboard outside a text field may not work on Windows. The page
  shortcut in `editor-shell/index.tsx` checks `e.key === "z"`, which is `"Z"`
  with Shift held on Windows, and it doesn't handle Ctrl+Y. This was already so
  on `main`; inside a text field both keys work.
- The smaller deferred items are listed under "Deferred" in the Stage 1, 2 and 3
  notes at the end of the spec.
