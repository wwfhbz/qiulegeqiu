import { VIEW } from './Viewport';

/** Fit the unchanged logical canvas into the room left by the compact controls. */
export function fitCanvas(width: number, height: number, chrome: number) {
  if (![width, height, chrome].every(Number.isFinite) || width <= 0 || height <= chrome || chrome < 0) return null;
  const w = Math.min(width, (height - chrome) * VIEW.width / VIEW.height);
  return { width: w, height: w * VIEW.height / VIEW.width };
}

export function fitGamePanel(room: HTMLElement, panel: HTMLElement, wrap: HTMLElement) {
  const resize = () => {
    // A child marked data-fill (the touch strip) stretches into whatever height is left, so it counts with its
    // minimum height here; otherwise its stretched height would shrink the arena on every resize.
    const chrome = Array.from(panel.children).filter(child => child !== wrap && !(child as HTMLElement).hidden)
      .reduce((height, child) => {const el=child as HTMLElement;return height + (el.dataset.fill!==undefined ? parseFloat(getComputedStyle(el).minHeight) || 0 : el.offsetHeight);}, 0);
    const size = fitCanvas(room.clientWidth, room.clientHeight, chrome);
    if (!size) return;
    panel.style.width = `${size.width}px`;
    wrap.style.height = `${size.height}px`;
  };
  new ResizeObserver(resize).observe(room);
  window.addEventListener('resize', resize);
  resize();
}
