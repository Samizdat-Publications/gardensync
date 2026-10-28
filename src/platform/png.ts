// A picture of the garden: the planner's SVG drawn onto a canvas and saved as a PNG.
//
// The SVG is styled with CSS variables from the page, which a standalone image cannot see, so the
// copy gets every element's computed paint and text styles written inline first. Fonts the page
// loaded are not available to the image either; text falls back to the system sans-serif.
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity'] as const;
const TEXT = ['font-size', 'font-weight', 'text-anchor', 'dominant-baseline'] as const;

function inlineStyles(source: Element, copy: Element): void {
  const cs = getComputedStyle(source);
  const parts: string[] = [];
  for (const prop of PAINT) parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
  if (source instanceof SVGTextElement || source instanceof SVGTSpanElement) {
    for (const prop of TEXT) parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
    parts.push('font-family:system-ui,sans-serif');
  }
  if (cs.display === 'none' || cs.visibility === 'hidden') parts.push('display:none');
  copy.setAttribute('style', parts.join(';'));
  const kids = source.children;
  const copies = copy.children;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const c = copies[i];
    if (k && c) inlineStyles(k, c);
  }
}

export interface PngOptions {
  /** Pixels per SVG user unit; the result is clamped to 4096 px on its longer side. */
  scale?: number;
  /** Background colour painted under the garden. */
  background?: string;
}

/** Renders the SVG as it is on screen (its current viewBox) into a PNG blob. */
export async function svgToPng(svg: SVGSVGElement, opts: PngOptions = {}): Promise<Blob> {
  const box = svg.viewBox.baseVal;
  const w0 = box && box.width > 0 ? box.width : svg.clientWidth;
  const h0 = box && box.height > 0 ? box.height : svg.clientHeight;
  const scale = Math.min(opts.scale ?? 2, 4096 / Math.max(w0, h0, 1));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const copy = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, copy);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(w));
  copy.setAttribute('height', String(h));
  const xml = new XMLSerializer().serializeToString(copy);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = opts.background ?? '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Offers a blob to the gardener as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
