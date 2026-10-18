"use client";

import { MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { LocationSummary } from "@/lib/data/types";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

interface LocationComboboxProps {
  /** Shown before the visitor types anything. Comes from the server. */
  initialSuggestions: LocationSummary[];
  selected: LocationSummary | null;
  onSelect: (location: LocationSummary | null) => void;
  /** Free text, used when the visitor types a place without picking a suggestion. */
  text: string;
  onTextChange: (text: string) => void;
  inputId: string;
}

/** Instant, on-device filtering of places we already know about. */
function localMatches(query: string, known: LocationSummary[]): LocationSummary[] {
  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  return known.filter((location) => {
    if (seen.has(location.id)) return false;
    seen.add(location.id);
    return (
      location.nameBn.includes(needle) ||
      location.nameEn.toLowerCase().includes(needle) ||
      location.slug.replace(/-/g, " ").includes(needle)
    );
  });
}

function label(location: LocationSummary): string {
  return location.parentNameBn && location.type === "area"
    ? `${location.nameBn}, ${location.parentNameBn}`
    : location.nameBn;
}

/**
 * Location box with suggestions. Works in Bangla or English ("ধানমন্ডি" or
 * "dhanmondi"). Small and dependency-free on purpose: this is the first thing
 * people touch, on phones that may be slow.
 *
 * Keyboard: ↓ ↑ to move, Enter to choose, Esc to close.
 */
export function LocationCombobox({ initialSuggestions, selected, onSelect, text, onTextChange, inputId }: LocationComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(initialSuggestions);
  // The highlighted option is tracked by id, so it survives the list being
  // replaced when the server's answer arrives.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const activeIndex = activeId === null ? -1 : options.findIndex((option) => option.id === activeId);

  // Debounced lookup while the visitor types. Empty text is handled in the
  // change handler below, so this effect only ever talks to the server.
  useEffect(() => {
    const query = text.trim();
    if (query.length === 0) return;
    // A chosen place needs no further lookup.
    if (selected && label(selected) === text) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      requestRef.current?.abort();
      requestRef.current = controller;
      setLoading(true);
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = (await response.json()) as { locations?: LocationSummary[] };
        setOptions(body.locations ?? []);
      } catch {
        // Aborted or offline: keep whatever is already showing.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, selected]);

  function showInitialSuggestions() {
    requestRef.current?.abort();
    setOptions(initialSuggestions);
    setLoading(false);
    setActiveId(null);
  }

  function choose(location: LocationSummary) {
    onSelect(location);
    onTextChange(label(location));
    setOpen(false);
    setActiveId(null);
  }

  function clear() {
    onSelect(null);
    onTextChange("");
    showInitialSuggestions();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (options.length > 0) setActiveId(options[(activeIndex + 1) % options.length].id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length > 0) setActiveId(options[(activeIndex - 1 + options.length) % options.length].id);
    } else if (event.key === "Enter" && open && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveId(null);
    }
  }

  const hasText = text.trim().length > 0;
  const showEmpty = open && !loading && hasText && options.length === 0;
  const showLoading = open && loading && hasText && options.length === 0;

  return (
    <div className="relative">
      <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate" />
      <input
        id={inputId}
        type="text"
        name="q"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={60}
        placeholder={bn.search.locationPlaceholder}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          onTextChange(value);
          if (selected) onSelect(null);
          if (value.trim().length === 0) {
            showInitialSuggestions();
          } else {
            // Narrow what is already on screen straight away, so the list never
            // shows places that do not match while the server is still answering.
            setOptions((current) => localMatches(value, [...initialSuggestions, ...current]));
            setLoading(true);
          }
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="h-13 w-full rounded-lg border border-input bg-background pr-11 pl-11 text-base text-ink placeholder:text-slate focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
      />
      <input type="hidden" name="location" value={selected?.slug ?? ""} />

      {text.length > 0 ? (
        <button
          type="button"
          onClick={clear}
          aria-label={bn.search.locationClear}
          className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-slate hover:bg-accent hover:text-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
      ) : null}

      <ul
        id={listId}
        role="listbox"
        aria-label={bn.search.location}
        hidden={!open || (options.length === 0 && !showEmpty && !showLoading)}
        className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-popover p-1.5 shadow-[0_16px_32px_-12px_rgba(21,23,61,0.35)]"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown fires before the input's blur, so the click is not lost.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(option);
            }}
            onMouseEnter={() => setActiveId(option.id)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-base",
              index === activeIndex ? "bg-accent" : "",
            )}
          >
            <span className="font-bold text-ink">{option.nameBn}</span>
            <span className="truncate text-sm text-slate">{option.parentNameBn ?? option.nameEn}</span>
          </li>
        ))}
        {showLoading ? <li className="px-3 py-2.5 text-sm text-slate">{bn.search.locationLoading}</li> : null}
        {showEmpty ? <li className="px-3 py-2.5 text-sm text-slate">{bn.search.locationEmpty}</li> : null}
      </ul>
    </div>
  );
}
