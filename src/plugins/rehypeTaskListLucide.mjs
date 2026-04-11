import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const lucideEntryPath = fileURLToPath(import.meta.resolve("@lucide/astro"));
const lucideIconsDir = join(dirname(lucideEntryPath), "icons");

const baseSvgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
  focusable: "false",
};

function loadLucideIconDefinition(iconName) {
  const filePath = join(lucideIconsDir, `${iconName}.ts`);
  const source = readFileSync(filePath, "utf8");
  const match = source.match(/createLucideIcon\([^,]+,\s*(\[\[.*]])\)\s+as\s+AstroComponent;/s);

  if (!match) {
    throw new Error(`Unable to parse Lucide icon definition for "${iconName}" from ${filePath}`);
  }

  return Function(`return (${match[1]});`)();
}

function iconDefinitionToChildren(iconDefinition) {
  return iconDefinition.map(([tagName, properties]) => ({
    type: "element",
    tagName,
    properties,
    children: [],
  }));
}

const squareIconChildren = iconDefinitionToChildren(loadLucideIconDefinition("square"));
const squareCheckIconChildren = iconDefinitionToChildren(loadLucideIconDefinition("square-check"));

function cloneIconChildren(iconChildren) {
  return iconChildren.map(({ tagName, properties, children }) => ({
    type: "element",
    tagName,
    properties: { ...properties },
    children: [...children],
  }));
}

function createLucideIconNode(checked) {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["task-list-marker", checked ? "is-checked" : "is-unchecked"],
      role: "checkbox",
      "aria-checked": String(checked),
      "aria-disabled": "true",
      "aria-label": checked ? "Completed" : "Not completed",
    },
    children: [
      {
        type: "element",
        tagName: "svg",
        properties: { ...baseSvgProps },
        children: cloneIconChildren(checked ? squareCheckIconChildren : squareIconChildren),
      },
    ],
  };
}

function isTaskCheckbox(node) {
  if (node?.type !== "element" || node.tagName !== "input") return false;
  const { type, disabled } = node.properties ?? {};
  return type === "checkbox" && disabled !== undefined;
}

function isCheckedCheckbox(node) {
  return node?.properties?.checked === true;
}

function normalizeClassName(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function visit(node, visitor, parent = null) {
  visitor(node, parent);
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) visit(child, visitor, node);
}

export default function rehypeTaskListLucide() {
  return function transformer(tree) {
    visit(tree, (node) => {
      if (node?.type !== "element" || node.tagName !== "li") return;

      const className = normalizeClassName(node.properties?.className);
      if (!className.includes("task-list-item") || !Array.isArray(node.children)) return;

      const checkboxIndex = node.children.findIndex(isTaskCheckbox);
      if (checkboxIndex === -1) return;

      const checkbox = node.children[checkboxIndex];
      const checked = isCheckedCheckbox(checkbox);

      node.children.splice(checkboxIndex, 1, createLucideIconNode(checked));

      const nextNode = node.children[checkboxIndex + 1];
      if (nextNode?.type === "text") {
        nextNode.value = nextNode.value.replace(/^\s+/, "");
      }
    });
  };
}
