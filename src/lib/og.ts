import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function fontFile(pkg: string, file: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url))
  );
}

const fontRegular = fontFile("noto-sans", "noto-sans-latin-400-normal.woff");
const fontBold = fontFile("noto-sans", "noto-sans-latin-700-normal.woff");
const fontTcRegular = fontFile("noto-sans-tc", "noto-sans-tc-chinese-traditional-400-normal.woff");
const fontTcBold = fontFile("noto-sans-tc", "noto-sans-tc-chinese-traditional-700-normal.woff");
const fontScRegular = fontFile("noto-sans-sc", "noto-sans-sc-chinese-simplified-400-normal.woff");
const fontScBold = fontFile("noto-sans-sc", "noto-sans-sc-chinese-simplified-700-normal.woff");

export async function generateOgImage(title: string, description: string): Promise<Buffer> {
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#17181c",
          fontFamily: "Noto Sans, Noto Sans TC, Noto Sans SC",
          position: "relative",
        },
        children: [
          // Blue accent bar at top
          {
            type: "div",
            props: {
              style: {
                width: "100%",
                height: "6px",
                background: "linear-gradient(90deg, #4a7fa5 0%, #7ba4c9 60%, #17181c 100%)",
              },
            },
          },
          // Main content area
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1,
                padding: "52px 64px 48px",
              },
              children: [
                // Title + description
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column", gap: "20px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: 56,
                            fontWeight: 700,
                            color: "#e8edf3",
                            lineHeight: 1.2,
                            maxWidth: "960px",
                            letterSpacing: "-0.5px",
                          },
                          children: title,
                        },
                      },
                      description
                        ? {
                            type: "div",
                            props: {
                              style: {
                                fontSize: 28,
                                color: "#7a8fa3",
                                lineHeight: 1.6,
                                maxWidth: "840px",
                              },
                              children: description,
                            },
                          }
                        : null,
                    ],
                  },
                },
                // Footer row
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                    children: [
                      // Branding: dot + name
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  backgroundColor: "#5b8db8",
                                },
                              },
                            },
                            {
                              type: "div",
                              props: {
                                style: {
                                  fontSize: 22,
                                  fontWeight: 700,
                                  color: "#9dbdd6",
                                },
                                children: "健一 Kenichi",
                              },
                            },
                          ],
                        },
                      },
                      // Domain
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: 18,
                            color: "#3d4554",
                            fontWeight: 400,
                            letterSpacing: "0.5px",
                          },
                          children: "kenichi.photocat.blue",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Sans", data: fontRegular, weight: 400, style: "normal" },
        { name: "Noto Sans", data: fontBold, weight: 700, style: "normal" },
        { name: "Noto Sans TC", data: fontTcRegular, weight: 400, style: "normal" },
        { name: "Noto Sans TC", data: fontTcBold, weight: 700, style: "normal" },
        { name: "Noto Sans SC", data: fontScRegular, weight: 400, style: "normal" },
        { name: "Noto Sans SC", data: fontScBold, weight: 700, style: "normal" },
      ],
    }
  );

  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}
