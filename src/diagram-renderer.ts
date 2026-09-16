import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { HandwrittenDiagramSpec } from "./diagram.js";

const WIDTH = 1200;
const NODE_W = 300;
const NODE_H = 110;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

export async function renderHandwrittenDiagram(spec: HandwrittenDiagramSpec, outputDir = process.env.LINKEDIN_MCP_OUTPUT_DIR ?? ".linkedin-mcp/diagrams"): Promise<string> {
  const columns = spec.nodes.length <= 4 ? 1 : 2;
  const rows = Math.ceil(spec.nodes.length / columns);
  const height = Math.max(700, 220 + rows * 180 + (spec.footer ? 100 : 0));
  const positions = new Map<string, { x: number; y: number }>();
  spec.nodes.forEach((node, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    positions.set(node.id, { x: columns === 1 ? (WIDTH - NODE_W) / 2 : 170 + col * 560, y: 180 + row * 180 });
  });
  const edgeSvg = spec.edges.map((edge, i) => {
    const a = positions.get(edge.from)!, b = positions.get(edge.to)!;
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
    const label = edge.label ? `<text x="${(x1+x2)/2 + 12}" y="${(y1+y2)/2 - 8}" class="edge-label">${esc(edge.label)}</text>` : "";
    return `<path d="M ${x1} ${y1} Q ${(x1+x2)/2 + (i%2===0?10:-10)} ${(y1+y2)/2} ${x2} ${y2}" class="edge" marker-end="url(#arrow)"/>${label}`;
  }).join("\n");
  const nodeSvg = spec.nodes.map((node, i) => {
    const p = positions.get(node.id)!; const rotate = i%3===0?-0.7:i%3===1?0.5:-0.2;
    return `<g transform="rotate(${rotate} ${p.x+NODE_W/2} ${p.y+NODE_H/2})"><rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="18" class="node"/><text x="${p.x+NODE_W/2}" y="${p.y+65}" text-anchor="middle" class="node-text">${esc(node.label)}</text></g>`;
  }).join("\n");
  const footer = spec.footer ? `<text x="600" y="${height-55}" text-anchor="middle" class="footer">${esc(spec.footer)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}"><rect width="100%" height="100%" fill="#fffdf7"/><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="#222" stroke-width="2"/></marker></defs><style>.title,.node-text,.edge-label,.footer{font-family:"Comic Sans MS","Segoe Print",cursive;fill:#222}.title{font-size:46px;font-weight:700}.node-text{font-size:25px}.edge-label{font-size:19px}.footer{font-size:22px}.node{fill:#fff;stroke:#222;stroke-width:4}.edge{fill:none;stroke:#222;stroke-width:4;stroke-linecap:round}</style><text x="600" y="90" text-anchor="middle" class="title">${esc(spec.title)}</text>${edgeSvg}${nodeSvg}${footer}</svg>`;
  const dir = resolve(outputDir); await mkdir(dir, { recursive: true });
  const path = resolve(dir, `diagram-${randomUUID()}.png`);
  await sharp(Buffer.from(svg)).png().toFile(path);
  return path;
}
