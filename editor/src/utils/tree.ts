import type { TreeNode } from "../components/panels/sidebar";

export function collectLeaves(tree: TreeNode, prefix = ""): string[] {
  const leaves: string[] = [];
  for (const [key, val] of Object.entries(tree)) {
    const fullPath = prefix ? `${prefix}/${key}` : key;
    if (val === null || (typeof val === "object" && "weight" in val)) {
      leaves.push(fullPath.replace(/\.md$/, ""));
    } else if (typeof val === "object" && val !== null) {
      leaves.push(...collectLeaves(val as TreeNode, fullPath));
    }
  }
  return leaves;
}
