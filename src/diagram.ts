export type DiagramNode = {
  id: string;
  label: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type HandwrittenDiagramSpec = {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  footer?: string;
};

/**
 * Validate and normalize a diagram before it is rendered.
 * Rendering is deliberately separate from LinkedIn publication so the
 * generated artifact can be reviewed by a human first.
 */
export function normalizeDiagram(spec: HandwrittenDiagramSpec): HandwrittenDiagramSpec {
  const title = spec.title.trim();
  if (!title) throw new Error("Diagram title is required");
  if (spec.nodes.length < 2) throw new Error("A diagram requires at least two nodes");
  if (spec.nodes.length > 12) throw new Error("A diagram supports at most 12 nodes in the MVP");

  const ids = new Set<string>();
  const nodes = spec.nodes.map((node) => {
    const id = node.id.trim();
    const label = node.label.trim();
    if (!id || !label) throw new Error("Every diagram node requires an id and label");
    if (ids.has(id)) throw new Error(`Duplicate diagram node id: ${id}`);
    ids.add(id);
    return { id, label };
  });

  const edges = spec.edges.map((edge) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      throw new Error(`Diagram edge references an unknown node: ${edge.from} -> ${edge.to}`);
    }
    return { from: edge.from, to: edge.to, ...(edge.label?.trim() ? { label: edge.label.trim() } : {}) };
  });

  return { title, nodes, edges, ...(spec.footer?.trim() ? { footer: spec.footer.trim() } : {}) };
}
