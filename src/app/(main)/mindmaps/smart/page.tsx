import { redirect } from "next/navigation";

/**
 * The smart mindmap used to live at its own URL, but it's now embedded
 * directly at the top of /mindmaps (see SmartMindMapSection). Anything
 * linking to /mindmaps/smart — old bookmarks, external docs, the Today
 * jump-link — lands on the merged page.
 */
export default function SmartMindMapLegacyRedirect() {
  redirect("/mindmaps");
}
