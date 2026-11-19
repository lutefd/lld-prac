import { usePreferences } from "./preferences";
import { useRef, type PointerEvent } from "react";

type Props = {
  label: string;
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: () => number;
  onChange: (value: number) => void;
  onReset: () => void;
};

export default function PanelDivider({
  label,
  orientation,
  value,
  min,
  max,
  onChange,
  onReset,
}: Props) {
  const { t } = usePreferences();
  const drag = useRef<{ coordinate: number; value: number } | null>(null);
  const vertical = orientation === "vertical";
  const resize = (next: number) =>
    onChange(Math.round(Math.max(min, Math.min(max(), next))));
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.classList.remove(
      "resizing-panels",
      "resizing-vertical",
      "resizing-horizontal",
    );
  };
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.round(Math.max(min, max()))}
      tabIndex={0}
      className={`panel-divider ${vertical ? "vertical" : "horizontal"}`}
      title={t("Drag to resize · Arrow keys to adjust · Double-click to reset")}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        const pane = vertical
          ? event.currentTarget.previousElementSibling
          : event.currentTarget.nextElementSibling;
        const bounds = pane?.getBoundingClientRect();
        drag.current = {
          coordinate: vertical ? event.clientX : event.clientY,
          value: (vertical ? bounds?.width : bounds?.height) ?? value,
        };
        document.body.classList.add(
          "resizing-panels",
          vertical ? "resizing-vertical" : "resizing-horizontal",
        );
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const delta = vertical
          ? event.clientX - drag.current.coordinate
          : drag.current.coordinate - event.clientY;
        resize(drag.current.value + delta);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={() => {
        drag.current = null;
        document.body.classList.remove(
          "resizing-panels",
          "resizing-vertical",
          "resizing-horizontal",
        );
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const increase = vertical ? "ArrowRight" : "ArrowUp";
        const decrease = vertical ? "ArrowLeft" : "ArrowDown";
        if (event.key === increase || event.key === decrease) {
          event.preventDefault();
          resize(
            value +
              (event.key === increase ? 1 : -1) * (event.shiftKey ? 40 : 10),
          );
        } else if (event.key === "Home") {
          event.preventDefault();
          resize(min);
        } else if (event.key === "End") {
          event.preventDefault();
          resize(max());
        }
      }}
    >
      <span />
    </div>
  );
}
