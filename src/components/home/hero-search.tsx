"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { LocationCombobox } from "@/components/location/location-combobox";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { LocationSummary } from "@/lib/data/types";
import { BEDROOM_OPTIONS, MODE_CONFIG, priceSteps } from "@/lib/domain/search-options";
import type { PropertyType, Purpose } from "@/lib/domain/types";
import { SEARCH_MODES, type SearchMode } from "@/lib/domain/urls";
import { formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink">
      {children}
    </label>
  );
}

/**
 * The search panel on the home page.
 *
 * It is an ordinary GET form pointing at /search, so it still works if the
 * script has not loaded yet. With script, submitting builds a tidy URL that
 * leaves out anything not chosen.
 */
export function HeroSearch({ popularLocations }: { popularLocations: LocationSummary[] }) {
  const router = useRouter();
  const id = useId();

  const [mode, setMode] = useState<SearchMode>("buy");
  const [commercialPurpose, setCommercialPurpose] = useState<Purpose>("rent");
  const [location, setLocation] = useState<LocationSummary | null>(null);
  const [locationText, setLocationText] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [bedrooms, setBedrooms] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const config = MODE_CONFIG[mode];
  const purpose: Purpose = config.purpose ?? commercialPurpose;
  const steps = priceSteps(purpose);

  function changeMode(next: SearchMode) {
    setMode(next);
    // Options differ between modes, so earlier choices may no longer exist.
    setPropertyType("");
    setBedrooms("");
    setMinPrice("");
    setMaxPrice("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (config.purpose === null) params.set("purpose", commercialPurpose);
    if (location) params.set("location", location.slug);
    else if (locationText.trim()) params.set("q", locationText.trim());
    if (propertyType) params.set("type", propertyType);
    if (config.showBedrooms && bedrooms) params.set("beds", bedrooms);

    // If someone picks a minimum above the maximum, read it as a range anyway.
    let low = minPrice ? Number(minPrice) : null;
    let high = maxPrice ? Number(maxPrice) : null;
    if (low !== null && high !== null && low > high) [low, high] = [high, low];
    if (low !== null) params.set("min_price", String(low));
    if (high !== null) params.set("max_price", String(high));

    router.push(`/search?${params.toString()}`);
  }

  const priceLabel = purpose === "rent" ? [bn.search.minRent, bn.search.maxRent] : [bn.search.minPrice, bn.search.maxPrice];

  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label={bn.search.formLabel}
      onSubmit={handleSubmit}
      className="rounded-2xl bg-background p-4 text-ink shadow-[0_24px_48px_-24px_rgba(21,23,61,0.55)] ring-1 ring-line sm:p-5 lg:p-6"
    >
      <fieldset>
        <legend className="sr-only">{bn.search.modeLabel}</legend>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-cloud p-1 sm:inline-grid sm:min-w-[26rem]">
          {SEARCH_MODES.map((option) => (
            <label
              key={option}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-bold whitespace-nowrap select-none sm:text-base",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                mode === option ? "bg-ink text-white" : "text-slate hover:text-ink",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={option}
                checked={mode === option}
                onChange={() => changeMode(option)}
                className="sr-only"
              />
              {bn.search.modes[option]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Two columns on phones; one row of fields from laptop width up. */}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3.5 lg:flex lg:items-end">
        <div className="col-span-2 lg:min-w-0 lg:flex-[1.9]">
          <FieldLabel htmlFor={`${id}-location`}>{bn.search.location}</FieldLabel>
          <LocationCombobox
            inputId={`${id}-location`}
            initialSuggestions={popularLocations}
            selected={location}
            onSelect={setLocation}
            text={locationText}
            onTextChange={setLocationText}
          />
        </div>

        {config.purpose === null ? (
          <div className="col-span-2 lg:min-w-0 lg:flex-1">
            <FieldLabel htmlFor={`${id}-purpose`}>{bn.search.saleOrRent}</FieldLabel>
            <NativeSelect
              id={`${id}-purpose`}
              name="purpose"
              value={commercialPurpose}
              onChange={(event) => {
                setCommercialPurpose(event.target.value as Purpose);
                setMinPrice("");
                setMaxPrice("");
              }}
              className="h-13"
            >
              <option value="rent">{PURPOSE_LABEL.rent}</option>
              <option value="sale">{PURPOSE_LABEL.sale}</option>
            </NativeSelect>
          </div>
        ) : null}

        <div className={cn(config.showBedrooms ? "col-span-1" : "col-span-2", "lg:min-w-0 lg:flex-1")}>
          <FieldLabel htmlFor={`${id}-type`}>{bn.search.propertyType}</FieldLabel>
          <NativeSelect
            id={`${id}-type`}
            name="type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value as PropertyType | "")}
            className="h-13"
          >
            <option value="">{bn.search.anyType}</option>
            {config.types.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </div>

        {config.showBedrooms ? (
          <div className="col-span-1 lg:min-w-0 lg:flex-[0.8]">
            <FieldLabel htmlFor={`${id}-beds`}>{bn.search.bedrooms}</FieldLabel>
            <NativeSelect
              id={`${id}-beds`}
              name="beds"
              value={bedrooms}
              onChange={(event) => setBedrooms(event.target.value)}
              className="h-13"
            >
              <option value="">{bn.search.anyBedrooms}</option>
              {BEDROOM_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {toBnDigits(count)}+
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="col-span-1 lg:min-w-0 lg:flex-1">
          <FieldLabel htmlFor={`${id}-min`}>{priceLabel[0]}</FieldLabel>
          <NativeSelect
            id={`${id}-min`}
            name="min_price"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="h-13"
          >
            <option value="">{bn.search.noMin}</option>
            {steps.map((step) => (
              <option key={step} value={step}>
                {formatPriceBn(step)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="col-span-1 lg:min-w-0 lg:flex-1">
          <FieldLabel htmlFor={`${id}-max`}>{priceLabel[1]}</FieldLabel>
          <NativeSelect
            id={`${id}-max`}
            name="max_price"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="h-13"
          >
            <option value="">{bn.search.noMax}</option>
            {steps.map((step) => (
              <option key={step} value={step}>
                {formatPriceBn(step)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="col-span-2 lg:shrink-0">
          <Button type="submit" variant="flame" size="lg" className="w-full lg:w-auto">
            <Search aria-hidden />
            {bn.search.submit}
          </Button>
        </div>
      </div>
    </form>
  );
}
