function visit(node, visitor, parent = null, index = -1) {
  visitor(node, parent, index);
  if (!node || !Array.isArray(node.children)) return;
  node.children.forEach((child, childIndex) => visit(child, visitor, node, childIndex));
}

function isWhitespaceText(node) {
  return node?.type === "text" && /^\s*$/.test(node.value ?? "");
}

function isStandaloneImageParagraph(node) {
  if (node?.type !== "element" || node.tagName !== "p" || !Array.isArray(node.children))
    return false;

  const contentNodes = node.children.filter((child) => !isWhitespaceText(child));
  return (
    contentNodes.length === 1 &&
    contentNodes[0]?.type === "element" &&
    contentNodes[0].tagName === "img"
  );
}

function getImageAltText(node) {
  const alt = node?.properties?.alt;
  return typeof alt === "string" ? alt.trim() : "";
}

const IMG_CLASSES = ["block", "max-w-[min(100%,36rem)]", "h-auto", "mx-auto"];

export default function rehypeImageCaption() {
  return function transformer(tree) {
    visit(tree, (node, parent, index) => {
      if (!parent || index === -1 || !isStandaloneImageParagraph(node)) return;

      const imageNode = node.children.find(
        (child) => child?.type === "element" && child.tagName === "img"
      );
      const altText = getImageAltText(imageNode);

      if (!altText) {
        // No caption — add prose image classes directly on the img
        imageNode.properties = {
          ...imageNode.properties,
          className: [...(imageNode.properties?.className ?? []), ...IMG_CLASSES, "my-6"],
        };
        return;
      }

      // Has caption — wrap in figure with figcaption
      const styledImageNode = {
        ...imageNode,
        properties: {
          ...imageNode.properties,
          className: [...(imageNode.properties?.className ?? []), ...IMG_CLASSES],
        },
      };

      parent.children[index] = {
        type: "element",
        tagName: "figure",
        properties: { className: ["w-fit", "max-w-full", "mx-auto", "my-6"] },
        children: [
          styledImageNode,
          {
            type: "element",
            tagName: "figcaption",
            properties: {
              className: ["mt-3", "text-center", "text-sm", "leading-normal", "text-fg-muted"],
            },
            children: [{ type: "text", value: altText }],
          },
        ],
      };
    });
  };
}
