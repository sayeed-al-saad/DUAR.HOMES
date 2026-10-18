/**
 * Amenity reference list. Loaded into the `amenities` table by the generated
 * reference-data migration; used directly only in demo mode.
 */
export interface AmenitySeed {
  slug: string;
  nameBn: string;
  nameEn: string;
}

export const AMENITIES: AmenitySeed[] = [
  { slug: "lift", nameBn: "লিফট", nameEn: "Lift" },
  { slug: "generator", nameBn: "জেনারেটর", nameEn: "Generator" },
  { slug: "parking", nameBn: "পার্কিং", nameEn: "Parking" },
  { slug: "security_guard", nameBn: "নিরাপত্তা প্রহরী", nameEn: "Security guard" },
  { slug: "cctv", nameBn: "সিসিটিভি", nameEn: "CCTV" },
  { slug: "gas_line", nameBn: "লাইনের গ্যাস", nameEn: "Piped gas" },
  { slug: "water_supply", nameBn: "সার্বক্ষণিক পানি", nameEn: "24-hour water" },
  { slug: "intercom", nameBn: "ইন্টারকম", nameEn: "Intercom" },
  { slug: "fire_safety", nameBn: "অগ্নিনিরাপত্তা ব্যবস্থা", nameEn: "Fire safety" },
  { slug: "rooftop", nameBn: "ছাদ ব্যবহারের সুযোগ", nameEn: "Rooftop access" },
  { slug: "community_hall", nameBn: "কমিউনিটি হল", nameEn: "Community hall" },
  { slug: "gym", nameBn: "জিম", nameEn: "Gym" },
  { slug: "playground", nameBn: "খেলার জায়গা", nameEn: "Play area" },
  { slug: "prayer_room", nameBn: "নামাজের জায়গা", nameEn: "Prayer room" },
  { slug: "garden", nameBn: "বাগান", nameEn: "Garden" },
  { slug: "swimming_pool", nameBn: "সুইমিং পুল", nameEn: "Swimming pool" },
  { slug: "air_conditioning", nameBn: "এসি", nameEn: "Air conditioning" },
  { slug: "boundary_wall", nameBn: "সীমানা প্রাচীর", nameEn: "Boundary wall" },
  { slug: "road_access", nameBn: "পাকা রাস্তার পাশে", nameEn: "On a paved road" },
];
