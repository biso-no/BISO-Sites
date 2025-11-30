"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Toggle } from "@repo/ui/components/ui/toggle";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Sparkles,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "tiptap-markdown";

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
};

type Level = 1 | 2 | 3;

// Regex patterns for markdown detection (defined at top level for performance)
const MARKDOWN_HEADER_REGEX = /^#{1,6}\s/m;
const MARKDOWN_BOLD_REGEX = /\*\*[^*]+\*\*/m;
const MARKDOWN_ITALIC_REGEX = /\*[^*]+\*/m;
const MARKDOWN_LIST_REGEX = /^[-*]\s/m;
const MARKDOWN_NUMBERED_LIST_REGEX = /^\d+\.\s/m;

export function RichTextEditor({
  content,
  onChange,
  editable = true,
}: RichTextEditorProps) {
  // Check if the editor appears empty for placeholder purposes
  const isEditorEmpty = (html: string) =>
    !html || html === "<p></p>" || html === "<p><br></p>" || html.trim() === "";

  // Used to stop event propagation
  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);
  const [_isEmpty, setIsEmpty] = useState(isEditorEmpty(content));

  // Add a reference to track if we should update parent
  const shouldUpdateParentRef = useRef(true);
  // Add a reference to track initial content
  const initialContentRef = useRef(content);

  const lowlight = createLowlight(common);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            "text-primary underline decoration-primary underline-offset-4 hover:text-primary/80 transition-colors",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        allowBase64: true,
        inline: true,
      }),
      Placeholder.configure({
        placeholder: "Write an epic description...",
        emptyEditorClass: "is-editor-empty",
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Markdown.configure({
        html: true, // Allow HTML in markdown
        transformPastedText: true, // Transform pasted markdown
        transformCopiedText: true, // Transform copied text to markdown
      }),
    ],
    content: initialContentRef.current,
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      try {
        const html = currentEditor.getHTML();
        setHtmlContent(html);
        setIsEmpty(isEditorEmpty(html));

        // Only update parent if we're supposed to
        if (shouldUpdateParentRef.current) {
          onChange(html);
        }
      } catch (error) {
        console.error("Editor update error:", error);
      }
    },
  });

  // Helper for mock events
  const createMockEvent = () =>
    ({
      preventDefault: () => {
        // no-op
      },
      stopPropagation: () => {
        // no-op
      },
    }) as React.MouseEvent;

  // Safely handle HTML mode toggle
  const handleHtmlModeToggle = useCallback(
    (newMode: boolean) => {
      if (!editor) {
        return;
      }

      try {
        shouldUpdateParentRef.current = false;

        // Get current content before switching
        if (newMode) {
          setHtmlContent(editor.getHTML());
        }

        setIsHtmlMode(newMode);

        // If switching back to visual mode, update editor content
        if (!newMode) {
          editor.commands.setContent(htmlContent);
        }

        // Resume parent updates after mode switch is complete
        setTimeout(() => {
          shouldUpdateParentRef.current = true;
        }, 0);
      } catch (error) {
        console.error("Error toggling HTML mode:", error);
        shouldUpdateParentRef.current = true;
      }
    },
    [editor, htmlContent]
  );

  // Update editor content when HTML mode changes content
  const handleHtmlChange = useCallback(
    (html: string) => {
      setHtmlContent(html);
      onChange(html);
    },
    [onChange]
  );

  // Update editor editable state when prop changes
  useEffect(() => {
    if (editor && editable !== editor.options.editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Update editor content when content prop changes externally (e.g., from AI assistant)
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (!content) {
      return;
    }

    // Don't update if the content is the same as what's in the editor
    const currentHtml = editor.getHTML();
    if (content === currentHtml) {
      return;
    }

    // Check if the incoming content looks like markdown
    // (contains markdown syntax like **, ##, -, etc. but not HTML tags)
    const startsWithHtml = content.startsWith("<");
    const hasMarkdownSyntax =
      MARKDOWN_HEADER_REGEX.test(content) ||
      MARKDOWN_BOLD_REGEX.test(content) ||
      MARKDOWN_ITALIC_REGEX.test(content) ||
      MARKDOWN_LIST_REGEX.test(content) ||
      MARKDOWN_NUMBERED_LIST_REGEX.test(content);
    const looksLikeMarkdown = !startsWithHtml && hasMarkdownSyntax;

    // Temporarily disable parent updates while we set content
    shouldUpdateParentRef.current = false;

    if (looksLikeMarkdown) {
      // Use the Markdown extension to parse markdown content
      // The editor.storage.markdown.getMarkdown() and setContent work together
      editor.commands.setContent(content);
    } else {
      // It's HTML, set directly
      editor.commands.setContent(content);
    }

    // Update our local state
    setHtmlContent(editor.getHTML());
    initialContentRef.current = content;

    // Re-enable parent updates
    setTimeout(() => {
      shouldUpdateParentRef.current = true;
    }, 0);
  }, [content, editor]);

  // Safely handle format clearing
  const handleClearFormat = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) {
        return;
      }

      try {
        shouldUpdateParentRef.current = false;

        editor.chain().focus().unsetAllMarks().setParagraph().run();

        shouldUpdateParentRef.current = true;
      } catch (error) {
        console.error("Error clearing format:", error);
        shouldUpdateParentRef.current = true;
      }
    },
    [editor]
  );

  // Safely handle heading changes
  const handleHeadingChange = useCallback(
    (level: Level, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) {
        return;
      }

      try {
        shouldUpdateParentRef.current = false;

        editor.chain().focus().toggleHeading({ level }).run();

        shouldUpdateParentRef.current = true;
      } catch (error) {
        console.error(`Error setting heading level ${level}:`, error);
        shouldUpdateParentRef.current = true;
      }
    },
    [editor]
  );

  // Safely handle link setting
  const handleSetLink = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) {
        return;
      }

      try {
        const previousUrl = editor.getAttributes("link").href;
        // biome-ignore lint/suspicious/noAlert: Simple prompt for now, TODO: Replace with Dialog
        const url = window.prompt("URL", previousUrl);

        // cancelled
        if (url === null) {
          return;
        }

        // empty
        if (url === "") {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }

        // update link
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .run();
      } catch (error) {
        console.error("Error setting link:", error);
      }
    },
    [editor]
  );

  // Safely handle image insertion
  const handleAddImage = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) {
        return;
      }

      try {
        // biome-ignore lint/suspicious/noAlert: Simple prompt for now, TODO: Replace with Dialog
        const url = window.prompt("Image URL");

        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } catch (error) {
        console.error("Error adding image:", error);
      }
    },
    [editor]
  );

  if (!editor) {
    return null;
  }

  return (
    <div
      className="glass-card overflow-hidden"
      onPointerDownCapture={stopPropagation}
      role="presentation"
    >
      {editable && (
        <div className="flex items-center justify-between border-primary/10 border-b bg-white/50 px-3 py-2 dark:bg-card/50">
          <div className="flex gap-1">
            <Button
              disabled={!isHtmlMode}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHtmlModeToggle(false);
              }}
              size="sm"
              variant={isHtmlMode ? "ghost" : "secondary"}
            >
              Visual
            </Button>
            <Button
              disabled={isHtmlMode}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHtmlModeToggle(true);
              }}
              size="sm"
              variant={isHtmlMode ? "secondary" : "ghost"}
            >
              <FileCode className="mr-2 h-4 w-4" />
              HTML
            </Button>
          </div>

          {!isHtmlMode && (
            <div className="flex gap-1">
              <Button
                className="h-8 w-8"
                disabled={!editor.can().undo()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().undo().run();
                }}
                size="icon"
                variant="ghost"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                className="h-8 w-8"
                disabled={!editor.can().redo()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().redo().run();
                }}
                size="icon"
                variant="ghost"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {isHtmlMode ? (
        <div>
          <Textarea
            className="min-h-[400px] resize-none rounded-none border-0 p-6 font-mono text-sm"
            disabled={!editable}
            onChange={(e) => handleHtmlChange(e.target.value)}
            onClick={stopPropagation}
            placeholder="Enter HTML content here..."
            value={htmlContent}
          />
        </div>
      ) : (
        <div>
          {editable && (
            <div className="flex flex-wrap gap-0.5 border-primary/10 border-b bg-primary/5 p-2 dark:bg-primary/10">
              <div className="mr-1 flex items-center border-r pr-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={stopPropagation}>
                    <Button
                      className="h-8 gap-1 font-normal text-xs"
                      onClick={stopPropagation}
                      size="sm"
                      variant="ghost"
                    >
                      <Heading2 className="h-4 w-4" />
                      <span>Heading</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={stopPropagation}>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={(e) => handleHeadingChange(1, e)}
                    >
                      <Heading1 className="h-4 w-4" />
                      <span className="font-bold text-lg">Heading 1</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={(e) => handleHeadingChange(2, e)}
                    >
                      <Heading2 className="h-4 w-4" />
                      <span className="font-bold text-base">Heading 2</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={(e) => handleHeadingChange(3, e)}
                    >
                      <Heading3 className="h-4 w-4" />
                      <span className="font-bold text-sm">Heading 3</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex gap-0.5">
                <Toggle
                  aria-label="Bold"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleBold().run();
                  }}
                  pressed={editor.isActive("bold")}
                  size="sm"
                >
                  <Bold className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Italic"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleItalic().run();
                  }}
                  pressed={editor.isActive("italic")}
                  size="sm"
                >
                  <Italic className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Underline"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleUnderline().run();
                  }}
                  pressed={editor.isActive("underline")}
                  size="sm"
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="mx-1 h-8 w-px bg-border" />

              <div className="flex gap-0.5">
                <Toggle
                  aria-label="Bullet List"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleBulletList().run();
                  }}
                  pressed={editor.isActive("bulletList")}
                  size="sm"
                >
                  <List className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Ordered List"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleOrderedList().run();
                  }}
                  pressed={editor.isActive("orderedList")}
                  size="sm"
                >
                  <ListOrdered className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="mx-1 h-8 w-px bg-border" />

              <div className="flex gap-0.5">
                <Toggle
                  aria-label="Link"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={(_pressed) => {
                    handleSetLink(createMockEvent());
                  }}
                  pressed={editor.isActive("link")}
                  size="sm"
                >
                  <LinkIcon className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Image"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={(_pressed) => {
                    handleAddImage(createMockEvent());
                  }}
                  pressed={editor.isActive("image")}
                  size="sm"
                >
                  <ImageIcon className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Code Block"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().toggleCodeBlock().run();
                  }}
                  pressed={editor.isActive("codeBlock")}
                  size="sm"
                >
                  <Code className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="mx-1 h-8 w-px bg-border" />

              <div className="flex gap-0.5">
                <Toggle
                  aria-label="Align Left"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("left").run();
                  }}
                  pressed={editor.isActive({ textAlign: "left" })}
                  size="sm"
                >
                  <AlignLeft className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Align Center"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("center").run();
                  }}
                  pressed={editor.isActive({ textAlign: "center" })}
                  size="sm"
                >
                  <AlignCenter className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Align Right"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("right").run();
                  }}
                  pressed={editor.isActive({ textAlign: "right" })}
                  size="sm"
                >
                  <AlignRight className="h-4 w-4" />
                </Toggle>

                <Toggle
                  aria-label="Align Justify"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("justify").run();
                  }}
                  pressed={editor.isActive({ textAlign: "justify" })}
                  size="sm"
                >
                  <AlignJustify className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="mx-1 h-8 w-px bg-border" />

              <Button
                className="h-8 gap-1 font-normal text-xs"
                onClick={handleClearFormat}
                size="sm"
                variant="ghost"
              >
                <Sparkles className="h-4 w-4" />
                Clear Format
              </Button>
            </div>
          )}

          {/* biome-ignore lint/a11y/useSemanticElements: ContentEditable inside button is invalid */}
          <div
            className={`${editable ? "relative min-h-[300px] cursor-text p-6" : "p-0"}`}
            onClick={(e) => {
              stopPropagation(e);
              if (editable) {
                editor.chain().focus().run();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                if (editable) {
                  editor.chain().focus().run();
                }
              }
            }}
            // biome-ignore lint/a11y/useSemanticElements: ContentEditable inside button is invalid
            role="button"
            tabIndex={0}
          >
            <EditorContent
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none"
              editor={editor}
            />
          </div>
        </div>
      )}

      {!editable && (
        <div className="p-0">
          <div
            className="prose prose-sm sm:prose-base lg:prose-lg max-w-none p-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Rich text editor content
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}
    </div>
  );
}
