import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type SyntheticEvent } from "react";
import type { RendererViewProps } from "./registry";

interface Size {
  w: number;
  h: number;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 32;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function ImageViewer({ ref }: RendererViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    setNatural(null);
    setView({ scale: 1, x: 0, y: 0 });
    void (async () => {
      try {
        const bytes = await window.api.file.readBytes(ref.path);
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: ref.mime }));
        setUrl(objectUrl);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref.path, ref.mime]);

  const containerSize = useCallback((): Size => {
    const element = containerRef.current;
    return { w: element?.clientWidth ?? 0, h: element?.clientHeight ?? 0 };
  }, []);

  const fit = useCallback(
    (mode: "contain" | "width") => {
      if (!natural) return;
      const { w, h } = containerSize();
      if (w <= 0 || h <= 0) return;
      const factor = mode === "width" ? w / natural.w : Math.min(w / natural.w, h / natural.h);
      const scale = clampScale(factor * (mode === "contain" ? 0.96 : 1));
      setView({ scale, x: (w - natural.w * scale) / 2, y: (h - natural.h * scale) / 2 });
    },
    [natural, containerSize]
  );

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setNatural({ w: image.naturalWidth || 1, h: image.naturalHeight || 1 });
  }, []);

  useEffect(() => {
    if (natural) fit("contain");
  }, [natural, fit]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !natural) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((current) => {
        const scale = clampScale(current.scale * factor);
        const ix = (mx - current.x) / current.scale;
        const iy = (my - current.y) / current.scale;
        return { scale, x: mx - ix * scale, y: my - iy * scale };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [natural]);

  const zoomBy = useCallback(
    (factor: number) => {
      const { w, h } = containerSize();
      const cx = w / 2;
      const cy = h / 2;
      setView((current) => {
        const scale = clampScale(current.scale * factor);
        const ix = (cx - current.x) / current.scale;
        const iy = (cy - current.y) / current.scale;
        return { scale, x: cx - ix * scale, y: cy - iy * scale };
      });
    },
    [containerSize]
  );

  const resetToActual = useCallback(() => {
    const { w, h } = containerSize();
    setView({ scale: 1, x: (w - (natural?.w ?? 0)) / 2, y: (h - (natural?.h ?? 0)) / 2 });
  }, [containerSize, natural]);

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragRef.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    },
    [view.x, view.y]
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setView((current) => ({
        ...current,
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY)
      }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center gap-1 border-b border-border bg-bg-subtle px-2 py-1 text-xs text-text-weak">
        <button type="button" onClick={() => zoomBy(1 / 1.2)} className={toolbarButton}>
          −
        </button>
        <span className="w-14 text-center tabular-nums">{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.2)} className={toolbarButton}>
          +
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => fit("contain")} className={toolbarButton}>
          Fit
        </button>
        <button type="button" onClick={() => fit("width")} className={toolbarButton}>
          Fit width
        </button>
        <button type="button" onClick={resetToActual} className={toolbarButton}>
          100%
        </button>
      </div>

      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
      >
        {error ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-xs text-text-weak">
            Failed to load image: {error}
          </div>
        ) : url ? (
          <img
            src={url}
            alt={ref.name}
            draggable={false}
            onLoad={onImageLoad}
            onError={() => setError("the image could not be decoded")}
            style={{
              position: "absolute",
              left: view.x,
              top: view.y,
              width: natural ? natural.w * view.scale : undefined,
              height: natural ? natural.h * view.scale : undefined,
              maxWidth: "none",
              imageRendering: view.scale >= 3 ? "pixelated" : "auto",
              userSelect: "none"
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-weak">Loading image…</div>
        )}
      </div>
    </div>
  );
}

const toolbarButton = "rounded border border-border px-2 py-0.5 hover:bg-panel hover:text-text";
