import { hasDom } from '../shared/env';

export interface FaviconBadgeOptions {
  /** Badge background. Defaults to `#dc2626`. */
  color?: string;
  textColor?: string;
  /** Canvas size in px. Defaults to `64`. */
  size?: number;
  /** Cap the number shown. Defaults to `99`. */
  max?: number;
  /** Show a dot instead of the number. */
  dot?: boolean;
}

function iconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

/** Draw an unread count on top of the page's favicon. */
export function createFaviconBadge({
  color = '#dc2626',
  textColor = '#ffffff',
  size = 64,
  max = 99,
  dot = false,
}: FaviconBadgeOptions = {}) {
  let original: string | null = null;
  let image: Promise<HTMLImageElement | null> | null = null;
  let version = 0;

  const loadImage = (href: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      if (!href) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = href;
    });

  return {
    async set(count: number) {
      if (!hasDom()) return;
      const link = iconLink();
      if (original === null) original = link.href;
      const mine = ++version;
      if (count <= 0) {
        link.href = original;
        return;
      }
      image ??= loadImage(original);
      const img = await image;
      if (mine !== version) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (img) ctx.drawImage(img, 0, 0, size, size);
      const radius = dot ? size * 0.22 : size * 0.3;
      const cx = size - radius;
      const cy = radius;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (!dot) {
        const text = count > max ? `${max}+` : String(count);
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(radius * (text.length > 2 ? 0.9 : 1.2))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy + 1);
      }
      try {
        link.href = canvas.toDataURL('image/png');
      } catch {
        // A cross-origin favicon taints the canvas; leave it as is.
      }
    },
    reset() {
      if (!hasDom() || original === null) return;
      version++;
      iconLink().href = original;
      original = null;
      image = null;
    },
  };
}
