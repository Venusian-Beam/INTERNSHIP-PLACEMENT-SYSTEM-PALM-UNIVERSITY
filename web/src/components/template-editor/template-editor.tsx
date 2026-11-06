"use client";

/**
 * Word-like editor for the uploaded letter template (FR-T1). Built on Tiptap (ProseMirror):
 * formatting, alignment, lists, tables and images, plus two inline "atom" nodes the letter engine understands:
 *   field chip   <span data-field="organisation.name">  → replaced by the real value on each letter
 *   signature    <span data-signature="">               → replaced by the President's signature image
 * The HTML it produces is sanitised again on the server before it is stored.
 */
import { EditorContent, mergeAttributes, Node, useEditor, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  TbAlignCenter,
  TbAlignJustified,
  TbAlignLeft,
  TbAlignRight,
  TbArrowBackUp,
  TbArrowForwardUp,
  TbBold,
  TbBraces,
  TbChevronDown,
  TbColumnInsertRight,
  TbH1,
  TbH2,
  TbItalic,
  TbList,
  TbListNumbers,
  TbPilcrow,
  TbRowInsertBottom,
  TbSignature,
  TbTable,
  TbTableMinus,
  TbUnderline,
} from "react-icons/tb";
import { cx } from "@/components/ui";

/** Short chip labels for each field key (the API sends longer descriptions for tooltips). */
export const FIELD_LABELS: Record<string, string> = {
  reference: "Reference no.",
  date: "Date",
  addressee: "Addressee",
  "organisation.name": "Organisation name",
  "organisation.address": "Organisation address",
  "period.start": "Start date",
  "period.end": "End date",
  student_count: "Number of students",
  "students.table": "Students table",
  "students.names": "Student names",
};

const FieldNode = Node.create({
  name: "field",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-field"),
        renderHTML: (a: { key: string }) => ({ "data-field": a.key }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-field]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "tpl-field" }), FIELD_LABELS[node.attrs.key] ?? node.attrs.key];
  },
  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },
});

const SignatureNode = Node.create({
  name: "signature",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "span[data-signature]" }];
  },
  renderHTML() {
    return ["span", { "data-signature": "", class: "tpl-signature" }, "Signature"];
  },
});

export type TemplateInfo = { fields: Set<string>; signature: boolean };

function inspect(editor: Editor): TemplateInfo {
  const fields = new Set<string>();
  let signature = false;
  editor.state.doc.descendants((n) => {
    if (n.type.name === "field" && n.attrs.key) fields.add(n.attrs.key);
    if (n.type.name === "signature") signature = true;
  });
  return { fields, signature };
}

export function TemplateEditor({
  content,
  editable,
  fields,
  onChange,
}: {
  content: string;
  editable: boolean;
  fields: Record<string, string>;
  onChange: (html: string, info: TemplateInfo, dirty: boolean) => void;
}) {
  const onChangeRef = useRef(onChange);
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: false, code: false, codeBlock: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      FieldNode,
      SignatureNode,
    ],
    content,
    editorProps: { attributes: { class: "tpl-doc", "aria-label": "Letter template", role: "textbox", "aria-multiline": "true" } },
    onCreate: ({ editor: e }) => {
      loaded.current = e.getHTML();
      onChangeRef.current(loaded.current, inspect(e), false);
    },
    // The editor normalises the document as it loads; only a real difference from that counts as unsaved.
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChangeRef.current(html, inspect(e), html !== loaded.current);
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <div className="h-[640px] animate-pulse rounded-[var(--radius)] bg-surface-2" aria-hidden />;

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-bg">
      {editable ? <Toolbar editor={editor} fields={fields} /> : null}
      <div className="max-h-[760px] overflow-auto bg-surface-2 p-4 sm:p-8">
        <div className="mx-auto max-w-[794px] bg-white px-[56px] py-[52px] shadow-[var(--shadow-lg)]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, fields }: { editor: Editor; fields: Record<string, string> }) {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    const onDoc = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as globalThis.Node) && setOpen(false);
    document.addEventListener("click", onDoc);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
      document.removeEventListener("click", onDoc);
    };
  }, [editor]);

  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-bg px-2 py-1.5" role="toolbar" aria-label="Formatting">
      <Btn icon={TbArrowBackUp} label="Undo" onClick={() => c().undo().run()} disabled={!editor.can().undo()} />
      <Btn icon={TbArrowForwardUp} label="Redo" onClick={() => c().redo().run()} disabled={!editor.can().redo()} />
      <Sep />
      <Btn icon={TbPilcrow} label="Normal text" active={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()} />
      <Btn icon={TbH1} label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn icon={TbH2} label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Sep />
      <Btn icon={TbBold} label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()} />
      <Btn icon={TbItalic} label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()} />
      <Btn icon={TbUnderline} label="Underline" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()} />
      <Sep />
      <Btn icon={TbAlignLeft} label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()} />
      <Btn icon={TbAlignCenter} label="Centre" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()} />
      <Btn icon={TbAlignRight} label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()} />
      <Btn icon={TbAlignJustified} label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => c().setTextAlign("justify").run()} />
      <Sep />
      <Btn icon={TbList} label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()} />
      <Btn icon={TbListNumbers} label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()} />
      <Btn icon={TbTable} label="Insert table" onClick={() => c().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()} />
      {inTable ? (
        <>
          <Btn icon={TbRowInsertBottom} label="Add row" onClick={() => c().addRowAfter().run()} />
          <Btn icon={TbColumnInsertRight} label="Add column" onClick={() => c().addColumnAfter().run()} />
          <Btn icon={TbTableMinus} label="Delete table" onClick={() => c().deleteTable().run()} />
        </>
      ) : null}
      <Sep />
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[color-mix(in_srgb,var(--c-indigo)_12%,white)] px-2.5 text-[12.5px] font-semibold text-[var(--c-indigo)] hover:bg-[color-mix(in_srgb,var(--c-indigo)_18%,white)]"
        >
          <TbBraces className="size-4" aria-hidden /> Insert field <TbChevronDown className="size-3.5" aria-hidden />
        </button>
        {open ? (
          <div role="menu" className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-auto rounded-[var(--radius)] border border-line bg-bg p-1 shadow-[var(--shadow-lg)]">
            {Object.keys(FIELD_LABELS)
              .filter((k) => k in fields)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    c().insertContent({ type: "field", attrs: { key: k } }).run();
                    setOpen(false);
                  }}
                  className="grid w-full gap-0.5 rounded-[6px] px-2.5 py-2 text-left hover:bg-surface"
                >
                  <span className="text-[13px] font-medium">{FIELD_LABELS[k]}</span>
                  <span className="text-[11.5px] text-muted">{fields[k]}</span>
                </button>
              ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => c().insertContent({ type: "signature" }).run()}
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[color-mix(in_srgb,var(--c-pink)_12%,white)] px-2.5 text-[12.5px] font-semibold text-[#be185d] hover:bg-[color-mix(in_srgb,var(--c-pink)_18%,white)]"
      >
        <TbSignature className="size-4" aria-hidden /> Signature
      </button>
    </div>
  );
}

function Btn({ icon: I, label, onClick, active, disabled }: { icon: IconType; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx("grid size-8 place-items-center rounded-[6px] text-muted hover:bg-surface hover:text-text disabled:opacity-35", active && "bg-brand-soft text-brand")}
    >
      <I className="size-[17px]" aria-hidden />
    </button>
  );
}

function Sep(): ReactNode {
  return <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />;
}
