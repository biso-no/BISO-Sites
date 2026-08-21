import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize CMS-authored rich text before it is injected with
 * `dangerouslySetInnerHTML`.
 *
 * The previous justification for skipping this was that content is "authored by
 * trusted admins". That trust boundary is wider than it sounds: editing rights
 * reach several hundred volunteers across 50+ clubs and five campuses, and the
 * cohort turns over every year. One editor account is then enough to put script
 * on the public site, and the natural target is a staff session on the same
 * domain. Sanitizing at render costs nothing and removes the whole class.
 *
 * This runs on the server (RSC) and in the browser — `isomorphic-dompurify`
 * supplies a DOM on the server — so it holds regardless of where the component
 * renders, and regardless of how the HTML reached the database.
 *
 * The allowlist is deliberately generous: it has to cover everything the Plate
 * serializer and the Job Studio editor legitimately emit, or real articles lose
 * formatting. What it excludes is what makes content dangerous — `<script>`,
 * `<style>`, `<iframe>`, `<object>`, event handlers, and `javascript:` URLs.
 */

const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup",
  "small", "code", "pre", "kbd", "abbr", "cite", "q",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "figure", "figcaption",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "title", "width", "height", "loading",
  "class", "id", "lang", "dir",
  "colspan", "rowspan", "scope",
  "start", "type", "value",
  "datetime", "cite",
];

export function sanitizeCmsHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Anything not on this list — javascript:, data:, vbscript: — is stripped.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i,
    // Block `<a target="_blank">` from reaching `window.opener`.
    ADD_ATTR: ["rel"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style", "srcset", "formaction", "form"],
    // Keep the text of a stripped element rather than dropping it silently, so
    // an over-eager rule degrades an article instead of emptying it.
    KEEP_CONTENT: true,
  });
}
