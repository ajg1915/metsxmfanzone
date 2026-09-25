import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon,
  Image as ImageIcon, FolderOpen, Code, Minus,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUploadRequest?: () => void;
  onMediaPick?: () => void;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your article…",
  onImageUploadRequest,
  onMediaPick,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-3" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[260px] sm:min-h-[360px] focus:outline-none px-3 py-3 text-sm leading-relaxed text-card prose-headings:text-card prose-p:text-card prose-li:text-card prose-strong:text-card prose-blockquote:text-card",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external changes (e.g., draft restore, AI generate, edit a post)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const ToolbarBtn = ({
    active, onClick, children, title,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 w-7 p-0 rounded",
        active && "bg-primary/20 text-primary",
      )}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("rounded-md border border-primary/40 bg-foreground text-card", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 p-1.5 sticky top-0 bg-card/90 text-foreground backdrop-blur z-10 rounded-t-md">
        <ToolbarBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="mx-1 h-4 w-px bg-border/40" />
        <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        {onImageUploadRequest && (
          <ToolbarBtn title="Insert image" onClick={onImageUploadRequest}><ImageIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        )}
        {onMediaPick && (
          <ToolbarBtn title="Insert from media library" onClick={onMediaPick}><FolderOpen className="w-3.5 h-3.5" /></ToolbarBtn>
        )}
        <div className="mx-1 h-4 w-px bg-border/40" />
        <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-3.5 h-3.5" /></ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Helper: insert an image url into the editor instance held in window scope. */
export function insertImageIntoEditor(editor: any, url: string) {
  if (!editor || !url) return;
  editor.chain().focus().setImage({ src: url }).run();
}
