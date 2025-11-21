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

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

type Level = 1 | 2 | 3;

export function RichTextEditor({ content, onChange, editable = true }: RichTextEditorProps) {
  // Check if the editor appears empty for placeholder purposes
  const isEditorEmpty = (html: string) => {
    return !html || html === "<p></p>" || html === "<p><br></p>" || html.trim() === "";
  };

  // Used to stop event propagation
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);
  const [isEmpty, setIsEmpty] = useState(isEditorEmpty(content));

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
    ],
    content: initialContentRef.current,
    editable,
    onUpdate: ({ editor }) => {
      try {
        const html = editor.getHTML();
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

  // Safely handle HTML mode toggle
  const handleHtmlModeToggle = useCallback(
    (newMode: boolean) => {
      if (!editor) return;

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
    [editor, htmlContent],
  );

  // Update editor content when HTML mode changes content
  const handleHtmlChange = useCallback(
    (html: string) => {
      setHtmlContent(html);
      onChange(html);
    },
    [onChange],
  );

  // Update editor editable state when prop changes
  useEffect(() => {
    if (editor && editable !== editor.options.editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Safely handle format clearing
  const handleClearFormat = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) return;

      try {
        shouldUpdateParentRef.current = false;

        editor.chain().focus().unsetAllMarks().setParagraph().run();

        shouldUpdateParentRef.current = true;
      } catch (error) {
        console.error("Error clearing format:", error);
        shouldUpdateParentRef.current = true;
      }
    },
    [editor],
  );

  // Safely handle heading changes
  const handleHeadingChange = useCallback(
    (level: Level, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) return;

      try {
        shouldUpdateParentRef.current = false;

        editor.chain().focus().toggleHeading({ level }).run();

        shouldUpdateParentRef.current = true;
      } catch (error) {
        console.error(`Error setting heading level ${level}:`, error);
        shouldUpdateParentRef.current = true;
      }
    },
    [editor],
  );

  // Safely handle link setting
  const handleSetLink = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) return;

      try {
        const previousUrl = editor.getAttributes("link").href;
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
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      } catch (error) {
        console.error("Error setting link:", error);
      }
    },
    [editor],
  );

  // Safely handle image insertion
  const handleAddImage = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!editor) return;

      try {
        const url = window.prompt("Image URL");

        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } catch (error) {
        console.error("Error adding image:", error);
      }
    },
    [editor],
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="glass-card overflow-hidden" onClick={stopPropagation}>
      {editable && (
        <div className="flex justify-between items-center px-3 py-2 border-b border-primary/10 bg-white/50 dark:bg-card/50">
          <div className="flex gap-1">
            <Button
              variant={isHtmlMode ? "ghost" : "secondary"}
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHtmlModeToggle(false);
              }}
              disabled={!isHtmlMode}
            >
              Visual
            </Button>
            <Button
              variant={isHtmlMode ? "secondary" : "ghost"}
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHtmlModeToggle(true);
              }}
              disabled={isHtmlMode}
            >
              <FileCode className="h-4 w-4 mr-2" />
              HTML
            </Button>
          </div>

          {!isHtmlMode && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().undo().run();
                }}
                disabled={!editor.can().undo()}
                className="h-8 w-8"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().redo().run();
                }}
                disabled={!editor.can().redo()}
                className="h-8 w-8"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {!isHtmlMode ? (
        <div>
          {editable && (
            <div className="flex flex-wrap gap-0.5 p-2 bg-primary/5 dark:bg-primary/10 border-b border-primary/10">
              <div className="flex items-center border-r pr-1 mr-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={stopPropagation}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs font-normal"
                      onClick={stopPropagation}
                    >
                      <Heading2 className="h-4 w-4" />
                      <span>Heading</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={stopPropagation}>
                    <DropdownMenuItem
                      onClick={(e) => handleHeadingChange(1, e)}
                      className="flex items-center gap-2"
                    >
                      <Heading1 className="h-4 w-4" />
                      <span className="text-lg font-bold">Heading 1</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleHeadingChange(2, e)}
                      className="flex items-center gap-2"
                    >
                      <Heading2 className="h-4 w-4" />
                      <span className="text-base font-bold">Heading 2</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleHeadingChange(3, e)}
                      className="flex items-center gap-2"
                    >
                      <Heading3 className="h-4 w-4" />
                      <span className="text-sm font-bold">Heading 3</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex gap-0.5">
                <Toggle
                  size="sm"
                  pressed={editor.isActive("bold")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleBold().run();
                  }}
                  aria-label="Bold"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <Bold className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive("italic")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleItalic().run();
                  }}
                  aria-label="Italic"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <Italic className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive("underline")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleUnderline().run();
                  }}
                  aria-label="Underline"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="w-px h-8 bg-border mx-1" />

              <div className="flex gap-0.5">
                <Toggle
                  size="sm"
                  pressed={editor.isActive("bulletList")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleBulletList().run();
                  }}
                  aria-label="Bullet List"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <List className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive("orderedList")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleOrderedList().run();
                  }}
                  aria-label="Ordered List"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <ListOrdered className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="w-px h-8 bg-border mx-1" />

              <div className="flex gap-0.5">
                <Toggle
                  size="sm"
                  pressed={editor.isActive("link")}
                  onPressedChange={(pressed) => {
                    handleSetLink({
                      preventDefault: () => {},
                      stopPropagation: () => {},
                    } as React.MouseEvent);
                  }}
                  aria-label="Link"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <LinkIcon className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive("image")}
                  onPressedChange={(pressed) => {
                    handleAddImage({
                      preventDefault: () => {},
                      stopPropagation: () => {},
                    } as React.MouseEvent);
                  }}
                  aria-label="Image"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <ImageIcon className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive("codeBlock")}
                  onPressedChange={() => {
                    editor.chain().focus().toggleCodeBlock().run();
                  }}
                  aria-label="Code Block"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <Code className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="w-px h-8 bg-border mx-1" />

              <div className="flex gap-0.5">
                <Toggle
                  size="sm"
                  pressed={editor.isActive({ textAlign: "left" })}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("left").run();
                  }}
                  aria-label="Align Left"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <AlignLeft className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive({ textAlign: "center" })}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("center").run();
                  }}
                  aria-label="Align Center"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <AlignCenter className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive({ textAlign: "right" })}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("right").run();
                  }}
                  aria-label="Align Right"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <AlignRight className="h-4 w-4" />
                </Toggle>

                <Toggle
                  size="sm"
                  pressed={editor.isActive({ textAlign: "justify" })}
                  onPressedChange={() => {
                    editor.chain().focus().setTextAlign("justify").run();
                  }}
                  aria-label="Align Justify"
                  className="h-8 w-8 p-0"
                  onClick={stopPropagation}
                >
                  <AlignJustify className="h-4 w-4" />
                </Toggle>
              </div>

              <div className="w-px h-8 bg-border mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFormat}
                className="h-8 gap-1 text-xs font-normal"
              >
                <Sparkles className="h-4 w-4" />
                Clear Format
              </Button>
            </div>
          )}

          <div
            className={`${editable ? "min-h-[300px] p-6 cursor-text relative" : "p-0"}`}
            onClick={(e) => {
              stopPropagation(e);
              editable && editor.chain().focus().run();
            }}
          >
            <EditorContent
              editor={editor}
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none"
            />
          </div>
        </div>
      ) : (
        <div>
          <Textarea
            value={htmlContent}
            onChange={(e) => handleHtmlChange(e.target.value)}
            className="min-h-[400px] rounded-none border-0 font-mono text-sm resize-none p-6"
            placeholder="Enter HTML content here..."
            disabled={!editable}
            onClick={stopPropagation}
          />
        </div>
      )}

      {!editable && (
        <div className="p-0">
          <div
            className="prose prose-sm sm:prose-base lg:prose-lg max-w-none p-6"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}
    </div>
  );
}
