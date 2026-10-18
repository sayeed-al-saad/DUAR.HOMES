"use client";

import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveListingPhotosAction, updateListingAction } from "@/app/account/listings/actions";
import { attachListingPhotos, submitListingAction } from "@/app/list-property/actions";
import { LocationCombobox } from "@/components/location/location-combobox";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { LocationSummary } from "@/lib/data/types";
import type { EditableListing } from "@/lib/listings/server";
import { categoryOf, FURNISHING_LEVELS, PROPERTY_TYPES, type PropertyType, type Purpose } from "@/lib/domain/types";
import { toBnDigits } from "@/lib/format/bn";
import { TERMS_PATH } from "@/lib/legal/content";
import { bn, FURNISHING_LABEL, LISTER_TYPE_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import {
  hasFloorNumber,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MIN_PHOTOS,
  PHOTO_TYPES,
  SUBMITTER_TYPES,
  submissionErrors,
  submissionSchema,
  type SubmissionErrors,
  type SubmissionInput,
} from "@/lib/listings/submission-schema";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const t = bn.submit;

interface ListingFormProps {
  popularLocations: LocationSummary[];
  amenities: Array<{ slug: string; nameBn: string }>;
  defaultName: string;
  /** Present when editing an existing listing. */
  edit?: {
    listingId: string;
    status: EditableListing["status"];
    values: EditableListing["values"];
    location: LocationSummary | null;
    photos: EditableListing["photos"];
  };
}

type Fields = Omit<SubmissionInput, "amenities" | "priceNegotiable" | "agree" | "showPhone" | "hasWhatsapp" | "purpose" | "propertyType" | "listerType"> & {
  purpose: Purpose | "";
  propertyType: PropertyType | "";
  listerType: (typeof SUBMITTER_TYPES)[number] | "";
};

/** A photo in the form: either already on the listing (existingId) or a new file to upload. */
interface Photo {
  id: string;
  preview: string;
  file?: File;
  existingId?: string;
}

/**
 * Redraws a photo on a canvas and saves the copy. Only the pixels survive,
 * so the camera's hidden data (GPS location, phone model, date) is dropped.
 * The original file is never uploaded: it may hold the house's exact
 * location, which the site keeps private. Returns null if the photo cannot
 * be redrawn; that photo is then skipped and the lister is told.
 */
async function shrink(file: File): Promise<{ blob: Blob; ext: string; type: string } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", type: "image/webp" };
    // Browsers without WebP encoding fall back to JPEG, still redrawn.
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (jpeg) return { blob: jpeg, ext: "jpg", type: "image/jpeg" };
  } catch {
    // Unreadable image: skip it.
  }
  return null;
}

function Field({ id, label, hint, error, children, className }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line p-4 sm:p-6">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * The "list your property" form. Saving is two steps: the listing is saved by
 * a server action, then the photos go from the browser straight to storage
 * (no large uploads through the site) and are recorded against the listing.
 */
export function ListingForm({ popularLocations, amenities, defaultName, edit }: ListingFormProps) {
  const router = useRouter();
  const start = edit?.values;
  const [fields, setFields] = useState<Fields>(
    start
      ? {
          purpose: start.purpose,
          propertyType: start.propertyType,
          locationSlug: edit.location?.slug ?? "",
          addressLine: start.addressLine,
          price: start.price,
          sizeSqft: start.sizeSqft,
          landSizeKatha: start.landSizeKatha,
          bedrooms: start.bedrooms,
          bathrooms: start.bathrooms,
          balconies: start.balconies,
          floorNumber: start.floorNumber,
          totalFloors: start.totalFloors,
          furnishing: (start.furnishing || undefined) as Fields["furnishing"],
          parkingSpaces: start.parkingSpaces,
          title: start.title,
          description: start.description,
          listerType: (SUBMITTER_TYPES as readonly string[]).includes(start.listerType) ? (start.listerType as Fields["listerType"]) : "owner",
          contactName: start.contactName,
          phone: start.phone,
        }
      : {
    purpose: "",
    propertyType: "",
    locationSlug: "",
    addressLine: "",
    price: "",
    sizeSqft: "",
    landSizeKatha: "",
    bedrooms: "",
    bathrooms: "",
    balconies: "",
    floorNumber: "",
    totalFloors: "",
    furnishing: undefined,
    parkingSpaces: "",
    title: "",
    description: "",
    listerType: "owner",
    contactName: defaultName,
    phone: "",
        },
  );
  const [location, setLocation] = useState<LocationSummary | null>(edit?.location ?? null);
  const [locationText, setLocationText] = useState(edit?.location?.nameBn ?? "");
  const [negotiable, setNegotiable] = useState(start?.priceNegotiable ?? false);
  const [agree, setAgree] = useState(false);
  const [showPhone, setShowPhone] = useState(start?.showPhone ?? true);
  const [hasWhatsapp, setHasWhatsapp] = useState(start?.hasWhatsapp ?? false);
  const [chosen, setChosen] = useState<string[]>(start?.amenities ?? []);
  const [photos, setPhotos] = useState<Photo[]>(
    () => edit?.photos.map((photo) => ({ id: photo.id, preview: photo.url, existingId: photo.id })) ?? [],
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<SubmissionErrors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const formTop = useRef<HTMLDivElement>(null);
  const photoUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = photoUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const category = fields.propertyType ? categoryOf(fields.propertyType) : null;
  const residential = category === "residential";
  const land = category === "land";
  const set = <K extends keyof Fields>(key: K) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));
  const invalid = (key: keyof SubmissionErrors) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `f-${String(key)}-error` } : {});

  function addPhotos(list: FileList | null) {
    if (!list) return;
    setPhotoError(null);
    const next: Photo[] = [];
    for (const file of Array.from(list)) {
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type) || file.size > MAX_PHOTO_BYTES * 4) {
        setPhotoError(t.badPhoto(file.name));
        continue;
      }
      const preview = URL.createObjectURL(file);
      photoUrls.current.push(preview);
      next.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview });
    }
    setPhotos((current) => {
      const all = [...current, ...next];
      if (all.length > MAX_PHOTOS) setPhotoError(t.tooManyPhotos);
      return all.slice(0, MAX_PHOTOS);
    });
  }

  async function uploadPhotos(userId: string, listingId: string): Promise<string[]> {
    const supabase = getSupabaseBrowserClient();
    const paths: string[] = [];
    const fresh = photos.filter((photo): photo is Photo & { file: File } => photo.file !== undefined);
    for (const [index, photo] of fresh.entries()) {
      setBusy(t.uploading(toBnDigits(index + 1), toBnDigits(fresh.length)));
      const copy = await shrink(photo.file);
      if (!copy || copy.blob.size > MAX_PHOTO_BYTES) continue;
      const { blob, ext, type } = copy;
      const path = `${userId}/${listingId}/${index + 1}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, blob, { contentType: type, upsert: false });
      if (!error) paths.push(path);
    }
    return paths;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      ...fields,
      locationSlug: location?.slug ?? "",
      priceNegotiable: negotiable,
      showPhone,
      hasWhatsapp,
      amenities: chosen,
      agree,
    } as unknown as SubmissionInput;

    const check = submissionSchema.safeParse(input);
    const noPhotos = photos.length < MIN_PHOTOS;
    setPhotoError(noPhotos ? t.errors.photoRequired : null);
    if (!check.success || noPhotos) {
      setErrors({ form: t.errors.fixBelow, ...(check.success ? {} : submissionErrors(check.error)) });
      formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setErrors({});
    if (edit) {
      await saveEdit(input);
      return;
    }
    setBusy(t.submitting);
    try {
      const result = await submitListingAction(input);
      if (result.status === "error") {
        setErrors(result.errors);
        formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      let photosOk = true;
      if (photos.length > 0) {
        const paths = await uploadPhotos(result.userId, result.listingId);
        const attached = paths.length > 0 ? await attachListingPhotos(result.listingId, paths, String(fields.title ?? "")) : 0;
        photosOk = attached === photos.length;
      }
      router.push(`/account/listings?submitted=${photosOk ? "1" : "photos"}`);
    } catch {
      setErrors({ form: t.errors.generic });
    } finally {
      setBusy(null);
    }
  }

  /** Edit mode: save the form, then the photos if they changed, then go back to "my listings". */
  async function saveEdit(input: SubmissionInput) {
    if (!edit) return;
    setBusy(bn.editListing.saving);
    try {
      const result = await updateListingAction(edit.listingId, input);
      if (result.status === "error") {
        setErrors(result.errors);
        formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const keep = photos.flatMap((photo) => (photo.existingId ? [photo.existingId] : []));
      const fresh = photos.filter((photo) => photo.file !== undefined);
      const photosChanged = fresh.length > 0 || keep.join() !== edit.photos.map((photo) => photo.id).join();
      let photosOk = true;
      if (photosChanged) {
        const paths = fresh.length > 0 ? await uploadPhotos(result.userId, edit.listingId) : [];
        const count = await saveListingPhotosAction(edit.listingId, keep, paths, String(fields.title ?? ""));
        photosOk = count === keep.length + fresh.length;
      }
      const nowStatus = photosChanged && result.listingStatus === "active" ? "pending_review" : result.listingStatus;
      const outcome = !photosOk ? "photos" : edit.status !== "active" ? "pending" : nowStatus === "active" ? "live" : "review";
      router.push(`/account/listings?edited=${outcome}`);
    } catch {
      setErrors({ form: t.errors.generic });
    } finally {
      setBusy(null);
    }
  }

  const priceLabel = fields.purpose === "rent" ? t.rent : t.price;
  const types = fields.purpose === "sale" ? PROPERTY_TYPES.filter((type) => type !== "room") : PROPERTY_TYPES;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div ref={formTop} className="scroll-mt-24">
        {errors.form ? (
          <Alert variant="error" role="alert">
            {errors.form}
          </Alert>
        ) : null}
      </div>

      <Section id="s-what" title={t.sections.what}>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-bold">{t.purpose}</legend>
          <div className="mt-1.5 flex gap-2">
            {(["sale", "rent"] as const).map((purpose) => (
              <label
                key={purpose}
                className={cn(
                  "flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 font-bold sm:flex-none sm:px-8",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                  fields.purpose === purpose ? "border-ink bg-ink text-white" : "border-input hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="purpose"
                  value={purpose}
                  checked={fields.purpose === purpose}
                  onChange={() => setFields((current) => ({ ...current, purpose, propertyType: purpose === "sale" && current.propertyType === "room" ? "" : current.propertyType }))}
                  className="sr-only"
                />
                {PURPOSE_LABEL[purpose]}
              </label>
            ))}
          </div>
          {errors.purpose ? <p className="mt-1 text-sm text-destructive">{errors.purpose}</p> : null}
        </fieldset>
        <Field id="f-propertyType" label={t.type} error={errors.propertyType}>
          <NativeSelect id="f-propertyType" value={fields.propertyType} onChange={set("propertyType")} {...invalid("propertyType")}>
            <option value="">{t.chooseType}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Section>

      <Section id="s-where" title={t.sections.where}>
        <Field id="f-locationSlug" label={t.location} hint={t.locationHint} error={errors.locationSlug} className="sm:col-span-2">
          <LocationCombobox
            inputId="f-locationSlug"
            initialSuggestions={popularLocations}
            selected={location}
            onSelect={setLocation}
            text={locationText}
            onTextChange={setLocationText}
          />
        </Field>
        <Field id="f-addressLine" label={t.address} hint={t.addressHint} error={errors.addressLine} className="sm:col-span-2">
          <Input id="f-addressLine" value={fields.addressLine as string} onChange={set("addressLine")} maxLength={300} autoComplete="street-address" {...invalid("addressLine")} />
        </Field>
      </Section>

      <Section id="s-price" title={t.sections.price}>
        <Field id="f-price" label={priceLabel} hint={t.priceHint} error={errors.price}>
          <Input id="f-price" inputMode="numeric" value={fields.price as string} onChange={set("price")} {...invalid("price")} />
        </Field>
        <label className="flex min-h-12 cursor-pointer items-center gap-2 self-end text-sm font-bold">
          <input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} className="size-5 accent-indigo" />
          {t.negotiable}
        </label>
        {land ? (
          <Field id="f-landSizeKatha" label={t.katha} error={errors.landSizeKatha}>
            <Input id="f-landSizeKatha" inputMode="decimal" value={fields.landSizeKatha as string} onChange={set("landSizeKatha")} {...invalid("landSizeKatha")} />
          </Field>
        ) : (
          <Field id="f-sizeSqft" label={t.size} error={errors.sizeSqft}>
            <Input id="f-sizeSqft" inputMode="numeric" value={fields.sizeSqft as string} onChange={set("sizeSqft")} {...invalid("sizeSqft")} />
          </Field>
        )}
      </Section>

      {category && !land ? (
        <Section id="s-details" title={t.sections.details}>
          {residential && fields.propertyType !== "room" ? (
            <Field id="f-bedrooms" label={t.bedrooms} error={errors.bedrooms}>
              <Input id="f-bedrooms" inputMode="numeric" value={fields.bedrooms as string} onChange={set("bedrooms")} {...invalid("bedrooms")} />
            </Field>
          ) : null}
          <Field id="f-bathrooms" label={t.bathrooms} error={errors.bathrooms}>
            <Input id="f-bathrooms" inputMode="numeric" value={fields.bathrooms as string} onChange={set("bathrooms")} {...invalid("bathrooms")} />
          </Field>
          {residential ? (
            <Field id="f-balconies" label={t.balconies} error={errors.balconies}>
              <Input id="f-balconies" inputMode="numeric" value={fields.balconies as string} onChange={set("balconies")} {...invalid("balconies")} />
            </Field>
          ) : null}
          {fields.propertyType && hasFloorNumber(fields.propertyType) ? (
            <Field id="f-floorNumber" label={t.floor} hint={t.floorHint} error={errors.floorNumber}>
              <Input id="f-floorNumber" inputMode="numeric" value={fields.floorNumber as string} onChange={set("floorNumber")} {...invalid("floorNumber")} />
            </Field>
          ) : null}
          <Field id="f-totalFloors" label={t.totalFloors} error={errors.totalFloors}>
            <Input id="f-totalFloors" inputMode="numeric" value={fields.totalFloors as string} onChange={set("totalFloors")} {...invalid("totalFloors")} />
          </Field>
          <Field id="f-furnishing" label={t.furnishing} error={errors.furnishing}>
            <NativeSelect
              id="f-furnishing"
              {...invalid("furnishing")}
              value={fields.furnishing ?? ""}
              onChange={(event) => setFields((current) => ({ ...current, furnishing: (event.target.value || undefined) as Fields["furnishing"] }))}
            >
              <option value="">{t.furnishingAny}</option>
              {FURNISHING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {FURNISHING_LABEL[level]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="f-parkingSpaces" label={t.parking} error={errors.parkingSpaces}>
            <Input id="f-parkingSpaces" inputMode="numeric" value={fields.parkingSpaces as string} onChange={set("parkingSpaces")} {...invalid("parkingSpaces")} />
          </Field>
        </Section>
      ) : null}

      <section aria-labelledby="s-amenities" className="rounded-2xl border border-line p-4 sm:p-6">
        <h2 id="s-amenities" className="text-xl">
          {t.sections.amenities}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {amenities.map((amenity) => (
            <li key={amenity.slug}>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(amenity.slug)}
                  onChange={(event) =>
                    setChosen((current) => (event.target.checked ? [...current, amenity.slug] : current.filter((slug) => slug !== amenity.slug)))
                  }
                  className="size-5 shrink-0 accent-indigo"
                />
                {amenity.nameBn}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="s-photos" className="rounded-2xl border border-line p-4 sm:p-6">
        <h2 id="s-photos" className="text-xl">
          {t.sections.photos}
        </h2>
        <p className="mt-1 text-sm text-slate">{t.photosHint}</p>
        {photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cloud">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, or a photo already on the listing */}
                <img src={photo.preview} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                  aria-label={t.removePhoto(toBnDigits(index + 1))}
                  className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length < MAX_PHOTOS ? (
          <label className="mt-4 inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-input px-4 font-bold hover:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-ring">
            <ImagePlus aria-hidden className="size-5 text-indigo" />
            {t.addPhotos}
            <input
              type="file"
              accept={PHOTO_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
        {photoError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {photoError}
          </p>
        ) : null}
      </section>

      <Section id="s-about" title={t.sections.about}>
        <Field id="f-title" label={t.titleLabel} hint={t.titleHint} error={errors.title} className="sm:col-span-2">
          <Input id="f-title" value={fields.title as string} onChange={set("title")} maxLength={120} placeholder={t.titlePlaceholder} {...invalid("title")} />
        </Field>
        <Field id="f-description" label={t.description} hint={t.descriptionHint} error={errors.description} className="sm:col-span-2">
          <textarea
            id="f-description"
            value={fields.description as string}
            onChange={set("description")}
            maxLength={2000}
            rows={5}
            placeholder={t.descriptionPlaceholder}
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive"
            {...invalid("description")}
          />
        </Field>
      </Section>

      <Section id="s-contact" title={t.sections.contact}>
        <Field id="f-listerType" label={t.listerType} error={errors.listerType}>
          <NativeSelect id="f-listerType" value={fields.listerType} onChange={set("listerType")}>
            {SUBMITTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {LISTER_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="f-contactName" label={t.contactName} error={errors.contactName}>
          <Input id="f-contactName" value={fields.contactName as string} onChange={set("contactName")} maxLength={80} autoComplete="name" {...invalid("contactName")} />
        </Field>
        <Field id="f-phone" label={t.phone} hint={t.phoneHint} error={errors.phone}>
          <Input id="f-phone" type="tel" inputMode="tel" value={fields.phone as string} onChange={set("phone")} autoComplete="tel" {...invalid("phone")} />
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={hasWhatsapp} onChange={(event) => setHasWhatsapp(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-indigo" />
            {bn.contact.hasWhatsapp}
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={showPhone}
              onChange={(event) => setShowPhone(event.target.checked)}
              aria-describedby="f-showPhone-hint"
              className="mt-0.5 size-5 shrink-0 accent-indigo"
            />
            <span>
              <span className="font-bold">{bn.contact.showPhone}</span>
              <span id="f-showPhone-hint" className="mt-0.5 block text-slate">
                {bn.contact.showPhoneHint}
              </span>
            </span>
          </label>
        </div>
      </Section>

      <div className="rounded-2xl bg-cloud p-4 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-indigo" />
          <span>
            {t.agree} {bn.legal.listingAgree.before}{" "}
            <Link href={TERMS_PATH} target="_blank" className="font-bold text-primary underline underline-offset-4">
              {bn.legal.termsLink}
              <span className="sr-only"> {bn.legal.opensNewTab}</span>
            </Link>{" "}
            {bn.legal.listingAgree.after}
          </span>
        </label>
        {errors.agree ? <p className="mt-1 text-sm text-destructive">{errors.agree}</p> : null}
        <Button type="submit" variant="flame" size="lg" className="mt-5 w-full sm:w-auto" disabled={busy !== null}>
          {busy ?? (edit ? bn.editListing.save : t.submit)}
        </Button>
      </div>
    </form>
  );
}
