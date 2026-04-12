"use client";

import { Fragment } from "react";

/**
 * Minimal read-only renderer for BlockNote v0.47 JSON content.
 * Not a full port — just covers the common block types so anonymous
 * viewers of shared links see the real content instead of [object Object].
 *
 * Blocks we recognise:
 *   paragraph, heading (props.level 1..3), bulletListItem, numberedListItem,
 *   checkListItem (props.checked), codeBlock, quote, table, image, file
 *
 * Unknown blocks fall through to a plain text rendering of their inline content.
 */

interface InlineText {
  type: "text";
  text: string;
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    textColor?: string;
    backgroundColor?: string;
  };
}
interface InlineLink {
  type: "link";
  href: string;
  content: InlineText[];
}
type Inline = InlineText | InlineLink;

interface Block {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: Inline[] | { type: "tableContent"; rows: { cells: Inline[][] }[] };
  children?: Block[];
}

function renderInline(items: Inline[] | undefined): React.ReactNode {
  if (!items) return null;
  return items.map((item, i) => {
    if (item.type === "link") {
      return (
        <a
          key={i}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400"
        >
          {renderInline(item.content)}
        </a>
      );
    }
    let node: React.ReactNode = item.text ?? "";
    const s = item.styles ?? {};
    if (s.bold) node = <strong key={i}>{node}</strong>;
    if (s.italic) node = <em key={i}>{node}</em>;
    if (s.underline) node = <u key={i}>{node}</u>;
    if (s.strike) node = <s key={i}>{node}</s>;
    if (s.code) node = <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-mono dark:bg-zinc-800">{node}</code>;
    return <Fragment key={i}>{node}</Fragment>;
  });
}

function renderBlock(block: Block, idx: number): React.ReactNode {
  const key = block.id ?? String(idx);
  const type = block.type ?? "paragraph";
  const children = block.children ?? [];
  const inlineContent = Array.isArray(block.content) ? (block.content as Inline[]) : undefined;

  const renderChildren = () =>
    children.length > 0 && (
      <div className="mt-2 ml-4">
        {children.map((c, i) => renderBlock(c, i))}
      </div>
    );

  switch (type) {
    case "heading": {
      const level = (block.props?.level as number) ?? 1;
      const cls =
        level === 1 ? "text-2xl font-bold mt-4 mb-2"
        : level === 2 ? "text-xl font-bold mt-3 mb-1.5"
        : "text-lg font-semibold mt-2 mb-1";
      const content = renderInline(inlineContent);
      return (
        <div key={key}>
          {level === 1 ? <h2 className={cls}>{content}</h2>
            : level === 2 ? <h3 className={cls}>{content}</h3>
            : <h4 className={cls}>{content}</h4>}
          {renderChildren()}
        </div>
      );
    }

    case "bulletListItem":
      return (
        <div key={key}>
          <div className="ml-4 flex gap-2">
            <span className="text-zinc-400">•</span>
            <div>{renderInline(inlineContent)}</div>
          </div>
          {renderChildren()}
        </div>
      );

    case "numberedListItem":
      return (
        <div key={key}>
          <div className="ml-4 flex gap-2">
            <span className="text-zinc-400">{idx + 1}.</span>
            <div>{renderInline(inlineContent)}</div>
          </div>
          {renderChildren()}
        </div>
      );

    case "checkListItem": {
      const checked = !!(block.props as { checked?: boolean } | undefined)?.checked;
      return (
        <div key={key}>
          <div className="ml-4 flex items-start gap-2">
            <input type="checkbox" checked={checked} readOnly className="mt-1" />
            <div className={checked ? "line-through text-zinc-400" : ""}>{renderInline(inlineContent)}</div>
          </div>
          {renderChildren()}
        </div>
      );
    }

    case "codeBlock":
      return (
        <pre key={key} className="my-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <code>{renderInline(inlineContent)}</code>
        </pre>
      );

    case "quote":
      return (
        <blockquote key={key} className="my-2 border-l-4 border-indigo-300 pl-4 italic text-zinc-600 dark:border-indigo-700 dark:text-zinc-400">
          {renderInline(inlineContent)}
          {renderChildren()}
        </blockquote>
      );

    case "table": {
      const tc = block.content as { type: "tableContent"; rows: { cells: Inline[][] }[] } | undefined;
      if (!tc || !Array.isArray(tc.rows)) return null;
      return (
        <div key={key} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse border border-zinc-300 text-sm dark:border-zinc-700">
            <tbody>
              {tc.rows.map((row, r) => (
                <tr key={r}>
                  {row.cells.map((cell, c) => (
                    <td key={c} className="border border-zinc-300 px-3 py-1.5 align-top dark:border-zinc-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "image": {
      const url = (block.props as { url?: string } | undefined)?.url;
      const caption = (block.props as { caption?: string } | undefined)?.caption;
      if (!url) return null;
      return (
        <figure key={key} className="my-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption || ""} className="max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700" />
          {caption && <figcaption className="mt-1 text-center text-xs text-zinc-500">{caption}</figcaption>}
        </figure>
      );
    }

    case "file": {
      const url = (block.props as { url?: string } | undefined)?.url;
      const name = (block.props as { name?: string } | undefined)?.name ?? "Attachment";
      if (!url) return null;
      return (
        <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="my-2 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-zinc-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
          📎 {name}
        </a>
      );
    }

    case "paragraph":
    default:
      return (
        <div key={key}>
          <p className="my-1.5 leading-relaxed">{renderInline(inlineContent)}</p>
          {renderChildren()}
        </div>
      );
  }
}

interface Props {
  blocks: unknown;
}

export function BlockNoteReadOnly({ blocks }: Props) {
  // Accept arrays; anything else falls back to empty.
  const list: Block[] = Array.isArray(blocks) ? (blocks as Block[]) : [];
  if (list.length === 0) {
    return <p className="italic text-zinc-400">This page is empty.</p>;
  }
  return <div className="prose-zinc dark:prose-invert max-w-none">{list.map((b, i) => renderBlock(b, i))}</div>;
}
