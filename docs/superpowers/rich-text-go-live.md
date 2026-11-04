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
   You should see the headings, nested bullets, the numbering restart after the
   paragraph, the red word in the nearest swatch, the link, the table with its
   header row and merged cell, and the notice "Images aren't pasted into text — use an Image block." for the picture.
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
10. **Select all in a text that opens with a table.** Press Cmd+A, then type,
    paste and press Delete in turn. The table is replaced or removed and no text
    is lost off to the side. Pasting only a picture leaves the text alone.
11. **The copilot.**
    - Ask it to write a text with a table and a coloured word. It should arrive
      as a real table and colour.
    - Ask it to change a text block that is not selected. It should find it
      and change it.
12. **Translate to EN** on a page with a list, a table with a merged cell and
    coloured text. The English page keeps the list, the table and the colour.
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
replaces the HTML text. If nobody saved in the new editor yet, rolling back is
clean. After that, the old site and the old editor show those text blocks as
empty. The text is still in the page and shows again when you redeploy. So fix
forward. If you must roll back, roll back web and admin both, and don't edit
those pages until you redeploy.

## Follow-ups (not blocking)

- If a copilot page tool runs in the browser and the browser refuses it, the
  error never reaches the model, and the chat still shows a tick for that call.
  The copilot may then say it made a change it did not. The prompt steers it
  away from the refused case. It was left alone because fixing it reworks a
  working flow.
- Rare undo case: type in a field, then another block changes (the copilot or the
  other surface), then undo in the field. The step back into page undo can bring
  the typing back. A fix needs one shared undo history for fields and page, which
  loses the caret-preserving field undo.
- A sanitiser timing test (150 ms bound) ran 170 ms once under heavy parallel
  load. It could flake in CI; loosen the bound or measure relative time if it does.
- The smaller deferred items are listed under "Deferred" in the Stage 1, 2 and 3
  notes at the end of the spec.
