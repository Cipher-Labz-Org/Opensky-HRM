"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type MenuItem = {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
};

type Session = {
  select: HTMLSelectElement;
  items: MenuItem[];
  activeIndex: number;
};

function isEligible(select: HTMLSelectElement) {
  if (select.disabled || select.multiple || select.size > 1) return false;
  if (select.dataset.nativeSelect != null) return false;
  return true;
}

function selectFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const direct = target instanceof HTMLSelectElement ? target : target.closest("select");
  if (direct instanceof HTMLSelectElement && isEligible(direct)) return direct;
  const label = target.closest("label");
  if (label instanceof HTMLLabelElement && label.control instanceof HTMLSelectElement && isEligible(label.control)) {
    return label.control;
  }
  return null;
}

function readItems(select: HTMLSelectElement): MenuItem[] {
  return Array.from(select.options).map((option) => {
    const parent = option.parentElement;
    const grouped = parent instanceof HTMLOptGroupElement;
    return {
      value: option.value,
      label: option.label || option.text,
      disabled: option.disabled || (grouped && parent.disabled),
      group: grouped ? parent.label : undefined,
    };
  });
}

function panelStyle(select: HTMLSelectElement, height: number): CSSProperties {
  const rect = select.getBoundingClientRect();
  const gap = 6;
  const edge = 8;
  const width = Math.max(rect.width, 160);
  const below = window.innerHeight - rect.bottom - gap - edge;
  const above = rect.top - gap - edge;
  const placement = height > below && above > below ? "up" : "down";
  const top = placement === "down" ? rect.bottom + gap : Math.max(edge, rect.top - gap - height);
  const left = Math.min(Math.max(edge, rect.left), window.innerWidth - width - edge);
  return { top, left, width, zIndex: 10050 };
}

function commitSelection(select: HTMLSelectElement, index: number) {
  if (select.selectedIndex === index) return;
  const indexSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex")?.set;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  const nextValue = select.options[index]?.value ?? "";
  indexSetter?.call(select, index);
  valueSetter?.call(select, nextValue);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function nextEnabled(items: MenuItem[], from: number, direction: 1 | -1) {
  if (items.length === 0) return -1;
  for (let step = 1; step <= items.length; step += 1) {
    const index = (from + direction * step + items.length) % items.length;
    if (!items[index]?.disabled) return index;
  }
  return -1;
}

export function NativeSelectMenu() {
  const [session, setSession] = useState<Session | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimer = useRef<number | null>(null);
  sessionRef.current = session;

  const close = useCallback(() => {
    const current = sessionRef.current?.select;
    setSession(null);
    current?.focus();
  }, []);

  const open = useCallback((select: HTMLSelectElement) => {
    const items = readItems(select);
    const selected = items.findIndex((_, index) => index === select.selectedIndex && !items[index]?.disabled);
    const activeIndex = selected >= 0 ? selected : items.findIndex((item) => !item.disabled);
    typeaheadRef.current = "";
    setStyle(panelStyle(select, 240));
    setSession({ select, items, activeIndex });
    select.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && panel.contains(event.target)) return;
      const select = selectFromEventTarget(event.target);
      if (select) {
        event.preventDefault();
        if (sessionRef.current?.select === select) {
          setSession(null);
          return;
        }
        open(select);
        return;
      }
      if (sessionRef.current) setSession(null);
    };
    const blockNativePopup = (event: Event) => {
      if (selectFromEventTarget(event.target)) event.preventDefault();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", blockNativePopup, true);
    document.addEventListener("click", blockNativePopup, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", blockNativePopup, true);
      document.removeEventListener("click", blockNativePopup, true);
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = sessionRef.current;
      if (!current) {
        const active = document.activeElement;
        if (!(active instanceof HTMLSelectElement) || !isEligible(active)) return;
        const opens =
          event.key === "ArrowDown" ||
          event.key === "ArrowUp" ||
          event.key === "Enter" ||
          event.key === " " ||
          event.key === "F4" ||
          (event.altKey && event.key === "ArrowDown");
        if (!opens) return;
        event.preventDefault();
        event.stopPropagation();
        open(active);
        return;
      }

      const { items, activeIndex, select } = current;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = nextEnabled(items, activeIndex, direction);
        if (next >= 0) setSession({ ...current, activeIndex: next });
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        const item = items[activeIndex];
        if (item && !item.disabled) {
          commitSelection(select, activeIndex);
          close();
        }
        return;
      }
      if (event.key === "Tab") {
        setSession(null);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        typeaheadRef.current = `${typeaheadRef.current}${event.key.toLowerCase()}`;
        if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
        typeaheadTimer.current = window.setTimeout(() => {
          typeaheadRef.current = "";
        }, 700);
        const query = typeaheadRef.current;
        const start = activeIndex >= 0 ? activeIndex : 0;
        const ordered = [...items.keys()].slice(start).concat([...items.keys()].slice(0, start));
        const match = ordered.find((index) => !items[index]?.disabled && items[index].label.toLowerCase().startsWith(query));
        if (match !== undefined) setSession({ ...current, activeIndex: match });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [close, open]);

  useLayoutEffect(() => {
    if (!session) return;
    const update = () => {
      const rect = session.select.getBoundingClientRect();
      if (!session.select.isConnected || (rect.width === 0 && rect.height === 0)) {
        setSession(null);
        return;
      }
      const height = panelRef.current?.offsetHeight || 240;
      setStyle(panelStyle(session.select, height));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [session]);

  useEffect(() => {
    if (!session || session.activeIndex < 0) return;
    const option = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[session.activeIndex];
    option?.scrollIntoView({ block: "nearest" });
  }, [session]);

  useEffect(() => {
    const select = session?.select;
    if (!select) return;
    select.setAttribute("aria-expanded", "true");
    return () => {
      select.removeAttribute("aria-expanded");
    };
  }, [session?.select]);

  if (!session || typeof document === "undefined") return null;

  return createPortal(
    <div ref={panelRef} className="opensky-select-panel" style={style} role="listbox">
      <div className="opensky-select-list">
        {session.items.length === 0 ? (
          <div className="opensky-select-empty">No options</div>
        ) : (
          session.items.map((item, index) => {
            const showGroup = Boolean(item.group) && item.group !== session.items[index - 1]?.group;
            return (
              <Fragment key={`${index}:${item.value}`}>
                {showGroup ? <div className="opensky-select-group">{item.group}</div> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={session.select.selectedIndex === index}
                  disabled={item.disabled}
                  data-selected={session.select.selectedIndex === index ? "true" : "false"}
                  data-active={session.activeIndex === index ? "true" : "false"}
                  className="opensky-select-option"
                  onMouseEnter={() => {
                    if (!item.disabled) setSession((current) => (current ? { ...current, activeIndex: index } : current));
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (item.disabled) return;
                    commitSelection(session.select, index);
                    close();
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label || " "}</span>
                </button>
              </Fragment>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
}
