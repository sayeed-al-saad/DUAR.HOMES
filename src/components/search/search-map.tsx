"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { MapArea } from "@/lib/data/types";
import { env } from "@/lib/env";
import { formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

export interface MapMarker extends MapArea {
  /** Where the marker leads: the list of these results in this place. */
  href: string;
}

/** Bangladesh, for when there is nothing to fit the map to. */
const COUNTRY_CENTER: [number, number] = [23.75, 90.35];

function popupContent(marker: MapMarker): HTMLElement {
  // Built from DOM nodes, never from an HTML string.
  const box = document.createElement("div");
  box.className = "duar-map-popup";
  const name = document.createElement("p");
  name.className = "font-bold text-base";
  name.textContent = marker.parentNameBn ? `${marker.nameBn}, ${marker.parentNameBn}` : marker.nameBn;
  const count = document.createElement("p");
  count.textContent = bn.map.count(toBnDigits(marker.count));
  const facts = document.createElement("p");
  facts.className = "whitespace-nowrap";
  facts.textContent = bn.map.from(formatPriceBn(marker.minPrice));
  const link = document.createElement("a");
  link.href = marker.href;
  link.className = "font-bold underline underline-offset-4";
  link.textContent = bn.map.openArea;
  box.append(name, count, facts, link);
  return box;
}

/**
 * The search map. One marker per place, at the place's centre, showing how many
 * matching properties it has and the lowest price. Leaflet loads only in the
 * browser, after the page; the list of places under the map works without it.
 */
export function SearchMap({ markers }: { markers: MapMarker[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;

    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        map = L.map(container.current, {
          center: COUNTRY_CENTER,
          zoom: 7,
          // The page scrolls past the map; zoom with the buttons or by pinching.
          scrollWheelZoom: false,
          // On phones one finger scrolls the page, not the map.
          dragging: !L.Browser.mobile,
        });
        map.zoomControl.getContainer()?.querySelectorAll("a").forEach((button, index) => {
          button.setAttribute("aria-label", index === 0 ? bn.map.zoomIn : bn.map.zoomOut);
          button.setAttribute("title", index === 0 ? bn.map.zoomIn : bn.map.zoomOut);
        });
        L.tileLayer(env.mapTileUrl, { attribution: env.mapAttribution, maxZoom: 18 }).addTo(map);

        const points: Array<[number, number]> = [];
        for (const marker of markers) {
          const label = bn.map.pin(toBnDigits(marker.count), formatPriceBn(marker.minPrice));
          const icon = L.divIcon({
            className: "duar-map-pin",
            html: `<span>${label}</span>`,
            iconSize: undefined,
            iconAnchor: [0, 0],
          });
          L.marker([marker.latitude, marker.longitude], {
            icon,
            keyboard: true,
            title: `${marker.nameBn}: ${bn.map.count(toBnDigits(marker.count))}, ${bn.map.from(formatPriceBn(marker.minPrice))}`,
            alt: marker.nameBn,
            riseOnHover: true,
          })
            .bindPopup(() => popupContent(marker), { minWidth: 200 })
            .addTo(map);
          points.push([marker.latitude, marker.longitude]);
        }
        if (points.length === 1) map.setView(points[0], 13);
        else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [markers]);

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={bn.map.label}
        className="h-[60vh] min-h-80 w-full overflow-hidden rounded-2xl border border-line bg-cloud"
      />
      {state !== "ready" ? (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate" role="status">
          {state === "loading" ? bn.map.loading : bn.map.failed}
        </p>
      ) : null}
    </div>
  );
}
