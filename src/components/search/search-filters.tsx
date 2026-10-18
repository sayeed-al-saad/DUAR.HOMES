"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { LocationCombobox } from "@/components/location/location-combobox";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { LocationSummary } from "@/lib/data/types";
import { BEDROOM_OPTIONS, MODE_CONFIG, priceSteps } from "@/lib/domain/search-options";
import { PROPERTY_TYPES, type PropertyType, type Purpose } from "@/lib/domain/types";
import { SEARCH_MODES, SEARCH_SORTS, searchPath, type SearchFilters, type SearchMode, type SearchSort } from "@/lib/domain/urls";
import { formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";

interface SearchFiltersProps {
  initial: SearchFilters;
  /** The place the results are for, when one was chosen or recognised. */
  initialLocation: LocationSummary | null;
  /** What was typed, when no place was chosen. */
  initialText: string;
  popularLocations: LocationSummary[];
}

function Field({ htmlFor, label, children }: { htmlFor: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Filters on the search page. An ordinary GET form (so it works before the
 * script loads); with script, it builds a tidy URL and changing the order
 * applies at once.
 */
export function SearchFiltersForm({ initial, initialLocation, initialText, popularLocations }: SearchFiltersProps) {
  const router = useRouter();
  const id = useId();

  const [mode, setMode] = useState<SearchMode | "">(initial.mode ?? "");
  const [purpose, setPurpose] = useState<Purpose | "">(initial.purpose ?? "");
  const [location, setLocation] = useState<LocationSummary | null>(initialLocation);
  const [locationText, setLocationText] = useState(initialText);
  const [propertyType, setPropertyType] = useState<PropertyType | "">(initial.propertyType ?? "");
  const [bedrooms, setBedrooms] = useState(initial.bedrooms ? String(initial.bedrooms) : "");
  const [minPrice, setMinPrice] = useState(initial.minPrice ? String(initial.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice ? String(initial.maxPrice) : "");
  const [sort, setSort] = useState<SearchSort>(initial.sort ?? "newest");
  const [ownerOnly, setOwnerOnly] = useState(Boolean(initial.ownerOnly));

  const config = mode ? MODE_CONFIG[mode] : null;
  const fixedPurpose = config?.purpose ?? null;
  const effectivePurpose: Purpose | null = fixedPurpose ?? (purpose || null);
  const types = config ? config.types : PROPERTY_TYPES;
  const showBedrooms = config ? config.showBedrooms : true;
  const steps = effectivePurpose ? priceSteps(effectivePurpose) : [];
  const priceLabels =
    effectivePurpose === "rent" ? [bn.search.minRent, bn.search.maxRent] : [bn.search.minPrice, bn.search.maxPrice];

  function changeMode(next: SearchMode | "") {
    setMode(next);
    // Earlier choices may not exist in the new mode.
    setPropertyType("");
    setMinPrice("");
    setMaxPrice("");
    if (next && !MODE_CONFIG[next].showBedrooms) setBedrooms("");
    if (next && MODE_CONFIG[next].purpose) setPurpose("");
  }

  function filtersNow(overrides: Partial<SearchFilters> = {}): SearchFilters {
    let low = minPrice ? Number(minPrice) : undefined;
    let high = maxPrice ? Number(maxPrice) : undefined;
    if (low !== undefined && high !== undefined && low > high) [low, high] = [high, low];
    return {
      mode: mode || undefined,
      purpose: !fixedPurpose && purpose ? purpose : undefined,
      location: location?.slug,
      propertyType: propertyType || undefined,
      bedrooms: showBedrooms && bedrooms ? Number(bedrooms) : undefined,
      minPrice: effectivePurpose ? low : undefined,
      maxPrice: effectivePurpose ? high : undefined,
      sort: sort === "newest" ? undefined : sort,
      ownerOnly: ownerOnly || undefined,
      view: initial.view,
      ...overrides,
    };
  }

  function go(filters: SearchFilters) {
    const path = searchPath(filters);
    const typed = !location && locationText.trim() ? locationText.trim() : "";
    router.push(typed ? `${path}${path.includes("?") ? "&" : "?"}q=${encodeURIComponent(typed)}` : path);
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label={bn.search.formLabel}
      onSubmit={(event) => {
        event.preventDefault();
        go(filtersNow());
      }}
      className="rounded-2xl border border-line bg-background p-4 sm:p-5"
    >
      {initial.view === "map" ? <input type="hidden" name="view" value="map" /> : null}
      <h2 className="mb-3 flex items-center gap-2 text-lg">
        <SlidersHorizontal aria-hidden className="size-5 text-indigo" />
        {bn.searchPage.filters}
      </h2>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 md:grid-cols-4">
        <div className="col-span-2">
          <Field htmlFor={`${id}-location`} label={bn.search.location}>
            <LocationCombobox
              inputId={`${id}-location`}
              initialSuggestions={popularLocations}
              selected={location}
              onSelect={setLocation}
              text={locationText}
              onTextChange={setLocationText}
            />
          </Field>
        </div>

        <Field htmlFor={`${id}-mode`} label={bn.searchPage.kind}>
          <NativeSelect id={`${id}-mode`} name="mode" value={mode} onChange={(event) => changeMode(event.target.value as SearchMode | "")}>
            <option value="">{bn.searchPage.anyKind}</option>
            {SEARCH_MODES.map((option) => (
              <option key={option} value={option}>
                {bn.search.modes[option]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {fixedPurpose ? null : (
          <Field htmlFor={`${id}-purpose`} label={bn.search.saleOrRent}>
            <NativeSelect
              id={`${id}-purpose`}
              name="purpose"
              value={purpose}
              onChange={(event) => {
                setPurpose(event.target.value as Purpose | "");
                setMinPrice("");
                setMaxPrice("");
              }}
            >
              <option value="">{bn.searchPage.anyPurpose}</option>
              <option value="sale">{PURPOSE_LABEL.sale}</option>
              <option value="rent">{PURPOSE_LABEL.rent}</option>
            </NativeSelect>
          </Field>
        )}

        <Field htmlFor={`${id}-type`} label={bn.search.propertyType}>
          <NativeSelect
            id={`${id}-type`}
            name="type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value as PropertyType | "")}
          >
            <option value="">{bn.search.anyType}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {showBedrooms ? (
          <Field htmlFor={`${id}-beds`} label={bn.search.bedrooms}>
            <NativeSelect id={`${id}-beds`} name="beds" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
              <option value="">{bn.search.anyBedrooms}</option>
              {BEDROOM_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {toBnDigits(count)}+
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}

        {effectivePurpose ? (
          <>
            <Field htmlFor={`${id}-min`} label={priceLabels[0]}>
              <NativeSelect id={`${id}-min`} name="min_price" value={minPrice} onChange={(event) => setMinPrice(event.target.value)}>
                <option value="">{bn.search.noMin}</option>
                {steps.map((step) => (
                  <option key={step} value={step}>
                    {formatPriceBn(step)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field htmlFor={`${id}-max`} label={priceLabels[1]}>
              <NativeSelect id={`${id}-max`} name="max_price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                <option value="">{bn.search.noMax}</option>
                {steps.map((step) => (
                  <option key={step} value={step}>
                    {formatPriceBn(step)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </>
        ) : null}

        <Field htmlFor={`${id}-sort`} label={bn.searchPage.sort}>
          <NativeSelect
            id={`${id}-sort`}
            name="sort"
            value={sort}
            onChange={(event) => {
              const next = event.target.value as SearchSort;
              setSort(next);
              go(filtersNow({ sort: next === "newest" ? undefined : next, page: undefined }));
            }}
          >
            {SEARCH_SORTS.map((option) => (
              <option key={option} value={option}>
                {bn.sorts[option]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={`${id}-owner`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            id={`${id}-owner`}
            type="checkbox"
            name="owner"
            value="1"
            checked={ownerOnly}
            onChange={(event) => setOwnerOnly(event.target.checked)}
            className="size-5 accent-indigo"
          />
          {bn.searchPage.ownerOnly}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/search")}>
            {bn.searchPage.clear}
          </Button>
          <Button type="submit" variant="flame">
            {bn.searchPage.apply}
          </Button>
        </div>
      </div>
    </form>
  );
}
