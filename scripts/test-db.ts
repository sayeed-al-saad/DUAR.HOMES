/**
 * Database test: applies every migration and the demo seed to a throwaway
 * database, then checks the schema, the content rules and the security rules
 * by acting as a visitor, as ordinary users, as staff and as the service role.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm run db:test
 *
 * DATABASE_URL must point at a PostgreSQL 15+ server where the user may create
 * databases. A temporary database is created and dropped again; nothing else on
 * the server is touched. Supabase itself is not required: the few Supabase
 * objects the migrations rely on are stubbed by scripts/sql/supabase-stubs.sql.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { bundledDemoRepository as demoRepository, computeAreaStats, publicDemoListingCount } from "../src/lib/data/demo-repository";
import { externalLinks, externalSites, listings, locations, properties } from "../src/lib/data/demo-dataset";
import { LOCATIONS } from "../src/data/locations";
import { stableUuid } from "../src/lib/ids";
import { toListingQuery } from "../src/lib/domain/listing-query";
import { parseSearchParams } from "../src/lib/domain/search-params";

const root = resolve(__dirname, "..");
const adminUrl = process.env.DATABASE_URL;

if (!adminUrl) {
  console.error("Set DATABASE_URL to a PostgreSQL server you can create databases on.");
  process.exit(2);
}

type Actor =
  | { kind: "superuser" }
  | { kind: "anon" }
  | { kind: "service" }
  | { kind: "user"; id: string };

const SUPER: Actor = { kind: "superuser" };
const ANON: Actor = { kind: "anon" };
const SERVICE: Actor = { kind: "service" };

let db: Client;
let passed = 0;
const failures: string[] = [];

/** Runs `work` in its own transaction as the given actor, the way PostgREST would. */
async function as<T>(actor: Actor, work: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (actor.kind === "anon") {
      await db.query("set local role anon");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
    } else if (actor.kind === "service") {
      await db.query("set local role service_role");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
    } else if (actor.kind === "user") {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: actor.id }),
      ]);
    }
    const result = await work();
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query(sql, params)).rows as T[];
}

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await rows<T>(sql, params);
  if (result.length !== 1) throw new Error(`expected exactly one row, got ${result.length}: ${sql}`);
  return result[0];
}

async function test(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${(error as Error).message}`);
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(label);
}

/** The work must fail, with the given SQLSTATE if one is supplied. */
async function denied(actor: Actor, work: () => Promise<unknown>, sqlstate?: string | string[]): Promise<void> {
  try {
    await as(actor, work);
  } catch (error) {
    const code = (error as { code?: string }).code;
    const allowed = sqlstate === undefined ? undefined : Array.isArray(sqlstate) ? sqlstate : [sqlstate];
    if (allowed && (!code || !allowed.includes(code))) {
      throw new Error(`failed as expected but with SQLSTATE ${code} (${(error as Error).message}), wanted ${allowed.join("/")}`);
    }
    return;
  }
  throw new Error("expected the database to refuse this, but it succeeded");
}

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";

function runSqlFile(path: string): Promise<unknown> {
  return db.query(readFileSync(path, "utf8"));
}

async function main(): Promise<void> {
  const databaseName = `duar_test_${Date.now()}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${databaseName}`);

  const testUrl = new URL(adminUrl as string);
  testUrl.pathname = `/${databaseName}`;
  db = new Client({ connectionString: testUrl.toString() });
  await db.connect();
  // Dropping the temporary database at the end closes this connection from the server side.
  db.on("error", () => undefined);

  try {
    console.log(`\nDatabase: ${databaseName}\n`);
    console.log("Applying migrations and seed");

    await test("Supabase stand-ins load", () => runSqlFile(resolve(root, "scripts/sql/supabase-stubs.sql")).then(() => undefined));

    const migrationDir = resolve(root, "supabase/migrations");
    const migrations = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of migrations) {
      await test(`migration ${file}`, () => runSqlFile(resolve(migrationDir, file)).then(() => undefined));
    }
    await test("seed.sql loads", () => runSqlFile(resolve(root, "supabase/seed.sql")).then(() => undefined));
    await test("reference data and seed can be run a second time", async () => {
      await runSqlFile(resolve(migrationDir, "20261008000600_reference_data.sql"));
      await runSqlFile(resolve(migrationDir, "20261008000900_external_sites_data.sql"));
      await runSqlFile(resolve(root, "supabase/seed.sql"));
    });

    if (failures.length > 0) throw new Error("setup failed; skipping the remaining checks");

    // -----------------------------------------------------------------------
    console.log("\nSchema and data");

    await test("every table in public has row-level security switched on", async () => {
      const unprotected = await rows<{ relname: string }>(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      );
      equal(unprotected.map((row) => row.relname), [], "tables without RLS");
      const total = await one<{ count: string }>(
        `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`,
      );
      equal(Number(total.count), 22, "table count");
    });

    await test("every foreign key is indexed, and no table has overlapping policies for one role", async () => {
      const unindexed = await rows<{ fk: string }>(
        `select c.relname || '.' || a.attname as fk
         from pg_constraint con
         join pg_class c on c.oid = con.conrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = c.oid and a.attnum = con.conkey[1]
         where con.contype = 'f' and n.nspname = 'public'
           and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = con.conkey[1])`,
      );
      equal(unindexed.map((row) => row.fk), [], "foreign keys without an index");

      const overlapping = await rows<{ target: string }>(
        `with expanded as (
           select tablename, unnest(roles) as role,
                  unnest(case when cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[cmd] end) as cmd
           from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'
         )
         select tablename || ' ' || role || ' ' || cmd as target from expanded group by tablename, role, cmd having count(*) > 1`,
      );
      equal(overlapping.map((row) => row.target), [], "overlapping policies");
    });

    await test("functions cannot be hijacked through search_path", async () => {
      const loose = await rows<{ name: string }>(
        `select n.nspname || '.' || p.proname as name
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private')
           and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) setting where setting like 'search_path=%')`,
      );
      equal(loose.map((row) => row.name), [], "functions without a fixed search_path");
    });

    await test("all 16 tables named in the brief exist", async () => {
      const wanted = [
        "users", "agents", "agencies", "properties", "property_listings", "sources", "listing_images",
        "locations", "favorites", "saved_searches", "inquiries", "reports", "price_history",
        "listing_changes", "listing_duplicates", "verification_records",
      ];
      const found = await rows<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
        [wanted],
      );
      equal(found.length, wanted.length, "tables found");
    });

    await test("location reference data: 8 divisions, 64 districts, every child has a parent", async () => {
      const counts = await rows<{ type: string; count: string }>(
        "select type::text, count(*) from public.locations group by type",
      );
      const byType = Object.fromEntries(counts.map((row) => [row.type, Number(row.count)]));
      equal(byType.division, 8, "divisions");
      equal(byType.district, 64, "districts");
      const total = await one<{ count: string }>("select count(*) from public.locations");
      equal(Number(total.count), LOCATIONS.length, "locations");
      const orphans = await one<{ count: string }>(
        "select count(*) from public.locations where type <> 'division' and parent_id is null",
      );
      equal(Number(orphans.count), 0, "orphans");
    });

    await test("demo rows are all flagged is_demo; reference data is not", async () => {
      const result = await one<{ listings: string; flagged: string; properties: string; real_source: string }>(
        `select
           (select count(*) from public.property_listings) as listings,
           (select count(*) from public.property_listings where is_demo) as flagged,
           (select count(*) from public.properties where is_demo) as properties,
           (select count(*) from public.sources where not is_demo) as real_source`,
      );
      equal(Number(result.listings), listings.length, "listings");
      equal(Number(result.flagged), listings.length, "flagged listings");
      equal(Number(result.properties), properties.length, "properties");
      equal(Number(result.real_source), 1 + externalSites.length, "non-demo sources (ours plus the real sites we link to)");
    });

    await test("one property can carry listings from more than one source", async () => {
      const shared = await rows(
        `select property_id from public.property_listings group by property_id having count(distinct source_id) > 1`,
      );
      truthy(shared.length >= 1, "expected at least one property with two sources");
    });

    await test("external demo listings hold no description, image or contact, and all link to their source", async () => {
      const result = await one<{ with_description: string; with_image: string; with_contact: string; without_url: string }>(
        `select
           count(*) filter (where l.description is not null) as with_description,
           count(*) filter (where exists (select 1 from public.listing_images i where i.listing_id = l.id)) as with_image,
           count(*) filter (where exists (select 1 from public.listing_contacts c where c.listing_id = l.id)) as with_contact,
           count(*) filter (where l.source_url is null) as without_url
         from public.property_listings l where l.origin = 'external'`,
      );
      equal(result, { with_description: "0", with_image: "0", with_contact: "0", without_url: "0" }, "external listing content");
    });

    await test("price history was recorded for every listing, twice where the price changed", async () => {
      const result = await one<{ listings: string; history: string; changed: string }>(
        `select
           (select count(*) from public.property_listings) as listings,
           (select count(*) from public.price_history) as history,
           (select count(*) from public.property_listings where previous_price is not null) as changed`,
      );
      equal(Number(result.history), Number(result.listings) + Number(result.changed), "price history rows");
    });

    // -----------------------------------------------------------------------
    console.log("\nVisitors (not signed in)");

    const pendingId = stableUuid("listing", "dhn-pending");
    const visibleFirstPartyId = stableUuid("listing", "dhn-s1");
    const externalId = stableUuid("listing", "dhn-s2");

    await test("see exactly the listings with a public status", async () => {
      const result = await as(ANON, () => one<{ count: string }>("select count(*) from public.listing_cards"));
      equal(Number(result.count), publicDemoListingCount(), "visible listings");
    });

    await test("cannot see a listing that is waiting for review, or its property or image", async () => {
      const result = await as(ANON, () =>
        one<{ listing: string; card: string; image: string; property: string }>(
          `select
             (select count(*) from public.property_listings where id = $1) as listing,
             (select count(*) from public.listing_cards where id = $1) as card,
             (select count(*) from public.listing_images where listing_id = $1) as image,
             (select count(*) from public.properties where id = $2) as property`,
          [pendingId, stableUuid("property", "dhn-pending")],
        ),
      );
      equal(result, { listing: "0", card: "0", image: "0", property: "0" }, "hidden rows");
    });

    await test("cannot read user profiles", () => denied(ANON, () => rows("select * from public.users"), PERMISSION_DENIED));
    await test("cannot read exact addresses", () => denied(ANON, () => rows("select * from public.property_private"), PERMISSION_DENIED));
    await test("cannot read lister contact details", () => denied(ANON, () => rows("select * from public.listing_contacts"), PERMISSION_DENIED));
    await test("cannot read internal source notes", () => denied(ANON, () => rows("select notes from public.sources"), PERMISSION_DENIED));
    await test("cannot read a source's permission status", () => denied(ANON, () => rows("select permission_status from public.sources"), PERMISSION_DENIED));
    await test("cannot read reports, duplicates, change log or verification records", async () => {
      for (const table of ["reports", "listing_duplicates", "listing_changes", "verification_records", "favorites", "saved_searches", "inquiries"]) {
        await denied(ANON, () => rows(`select * from public.${table}`), PERMISSION_DENIED);
      }
    });

    await test("can read a source's public name", async () => {
      const result = await as(ANON, () => rows("select name, website from public.sources"));
      truthy(result.length >= 4, "expected sources");
    });

    await test("cannot create, change or delete listings", async () => {
      await denied(ANON, () => rows("update public.property_listings set price = 1 where id = $1", [visibleFirstPartyId]), PERMISSION_DENIED);
      await denied(ANON, () => rows("delete from public.property_listings where id = $1", [visibleFirstPartyId]), PERMISSION_DENIED);
      await denied(
        ANON,
        () =>
          rows(
            `insert into public.property_listings (property_id, source_id, origin, purpose, title, slug, price)
             select property_id, source_id, origin, purpose, 'x title', 'anon-made', 5 from public.property_listings where id = $1`,
            [visibleFirstPartyId],
          ),
        PERMISSION_DENIED,
      );
    });

    await test("can report a visible listing, but not read reports back", async () => {
      await as(ANON, () =>
        rows("insert into public.reports (listing_id, reason, details) values ($1, 'copyright', 'test report')", [externalId]),
      );
      const stored = await one<{ count: string }>("select count(*) from public.reports where listing_id = $1", [externalId]);
      equal(Number(stored.count), 1, "stored reports");
    });

    await test("cannot report a hidden listing, set a report's status, or pose as a user", async () => {
      await denied(ANON, () => rows("insert into public.reports (listing_id, reason) values ($1, 'other')", [pendingId]), PERMISSION_DENIED);
      await denied(
        ANON,
        () => rows("insert into public.reports (listing_id, reason, status) values ($1, 'other', 'resolved')", [externalId]),
        PERMISSION_DENIED,
      );
      await denied(
        ANON,
        () => rows("insert into public.reports (listing_id, reason, reporter_user_id) values ($1, 'other', gen_random_uuid())", [externalId]),
        PERMISSION_DENIED,
      );
    });

    await test("area statistics from the database match the demo-mode calculation", async () => {
      const popular = locations.filter((location) => location.isPopular);
      const fromDb = await as(ANON, () =>
        rows<{
          slug: string;
          active_listing_count: string;
          avg_sale_price_per_sqft: string | null;
          sale_sample_size: string;
          avg_monthly_rent: string | null;
          rent_sample_size: string;
        }>("select * from public.location_listing_stats where is_popular"),
      );
      equal(fromDb.length, popular.length, "popular locations");
      for (const row of fromDb) {
        const expected = computeAreaStats(row.slug)!;
        equal(Number(row.active_listing_count), expected.activeListingCount, `${row.slug} listing count`);
        equal(Number(row.sale_sample_size), expected.saleSampleSize, `${row.slug} sale sample`);
        equal(Number(row.rent_sample_size), expected.rentSampleSize, `${row.slug} rent sample`);
        const sale = row.avg_sale_price_per_sqft === null ? null : Number(row.avg_sale_price_per_sqft);
        const rent = row.avg_monthly_rent === null ? null : Number(row.avg_monthly_rent);
        truthy(
          (sale === null && expected.avgSalePricePerSqft === null) || Math.abs((sale ?? 0) - (expected.avgSalePricePerSqft ?? 0)) <= 1,
          `${row.slug} average sale price per sq ft: db ${sale}, demo ${expected.avgSalePricePerSqft}`,
        );
        truthy(
          (rent === null && expected.avgMonthlyRent === null) || Math.abs((rent ?? 0) - (expected.avgMonthlyRent ?? 0)) <= 1,
          `${row.slug} average rent: db ${rent}, demo ${expected.avgMonthlyRent}`,
        );
      }
    });

    await test("search, area counts, price guide and listing pages match demo mode", async () => {
      const sqlSort: Record<string, string> = {
        newest: "first_seen_at desc, id",
        price_asc: "price asc, id",
        price_desc: "price desc, id",
        popular: "view_count desc, first_seen_at desc, id",
        price_drop: "price_changed_at desc nulls last, price_drop_percent desc, id",
      };
      const cases: Array<[Record<string, string>, string | null]> = [
        [{}, null],
        [{ mode: "rent" }, "dhaka"],
        [{ mode: "rent", beds: "3" }, "uttara"],
        [{ mode: "buy", sort: "price_asc" }, "dhaka"],
        [{ mode: "buy", sort: "price_desc", min_price: "10000000" }, null],
        [{ mode: "land" }, "dhaka-division"],
        [{ mode: "commercial", purpose: "rent" }, null],
        [{ sort: "popular", owner: "1" }, null],
        [{ sort: "price_drop" }, "chattogram"],
        [{ mode: "rent", type: "room" }, "dhaka"],
      ];
      for (const [raw, place] of cases) {
        const q = { ...toListingQuery(parseSearchParams(raw), place), pageSize: 500 };
        const where: string[] = ["status = 'active'", "is_group_lead"];
        const params: unknown[] = [];
        const add = (sql: string, value: unknown) => {
          params.push(value);
          where.push(sql.replace("?", `$${params.length}`));
        };
        if (q.locationSlug) add("place_slug = ?", q.locationSlug);
        if (q.purpose) add("purpose = ?", q.purpose);
        if (q.category) add("category = ?", q.category);
        if (q.propertyType) add("property_type = ?", q.propertyType);
        if (q.minBedrooms) add("bedrooms >= ?", q.minBedrooms);
        if (q.minPrice !== undefined) add("price >= ?", q.minPrice);
        if (q.maxPrice !== undefined) add("price <= ?", q.maxPrice);
        if (q.ownerOnly) where.push("origin = 'first_party' and lister_type = 'owner'");
        if (q.sort === "price_drop") where.push("price_drop_percent > 0");
        const view = q.locationSlug ? "public.listing_search" : "public.listing_cards";
        const fromDb = await as(ANON, () =>
          rows<{ id: string }>(`select id from ${view} where ${where.join(" and ")} order by ${sqlSort[q.sort]}`, params),
        );
        const fromDemo = await demoRepository.searchListings(q);
        equal(fromDb.map((row) => row.id), fromDemo.listings.map((card) => card.id), `search ${JSON.stringify(raw)} in ${place}`);
      }

      // One property, one card: the same lead, count and lowest price as demo mode.
      const groups = await as(ANON, () =>
        rows<{ id: string; is_group_lead: boolean; also_listed_count: number; group_min_price: string | null }>(
          "select id, is_group_lead, also_listed_count, group_min_price from public.listing_cards order by id",
        ),
      );
      const demoCards = (await demoRepository.searchListings({ sort: "newest", page: 1, pageSize: 500 })).listings;
      truthy(demoCards.length > 0, "demo cards");
      const demoAll = new Map<string, { lead: boolean; also: number; min: number | null }>();
      for (const listing of listings) {
        const detail = await demoRepository.getListingBySlug(listing.slug);
        if (detail) demoAll.set(detail.id, { lead: detail.isGroupLead, also: detail.alsoListedCount, min: detail.groupMinPrice });
      }
      equal(
        groups.map((row) => [row.id, row.is_group_lead, Number(row.also_listed_count), row.group_min_price === null ? null : Number(row.group_min_price)]),
        [...demoAll.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, g]) => [id, g.lead, g.also, g.min]),
        "listing groups",
      );
      truthy(groups.filter((row) => !row.is_group_lead).length >= 2, "the demo data has merged listings");

      // The search map: matching properties per place.
      for (const [raw, place] of [[{}, null], [{ mode: "rent" }, "dhaka"], [{ mode: "buy" }, "chattogram"]] as const) {
        const q = toListingQuery(parseSearchParams(raw), place);
        const params: unknown[] = [];
        let where = "status = 'active' and is_group_lead";
        if (q.locationSlug) { params.push(q.locationSlug); where += ` and place_slug = $${params.length}`; }
        if (q.purpose) { params.push(q.purpose); where += ` and purpose = $${params.length}`; }
        if (q.category) { params.push(q.category); where += ` and category = $${params.length}`; }
        const view = q.locationSlug ? "public.listing_search" : "public.listing_cards";
        const fromDb = await as(ANON, () =>
          rows<{ location_slug: string; count: string; min_price: string }>(
            `select location_slug, count(*), min(price) as min_price from ${view} where ${where}
             group by location_slug order by count(*) desc, location_slug`,
            params,
          ),
        );
        const fromDemo = await demoRepository.getMapAreas(q);
        equal(
          fromDb.map((row) => [row.location_slug, Number(row.count), Number(row.min_price)]),
          fromDemo.areas.map((area) => [area.slug, area.count, area.minPrice]),
          `map ${JSON.stringify(raw)} in ${place}`,
        );
      }

      const counts = await as(ANON, () =>
        rows<{ slug: string; mode: string; active_count: string; contains_demo_data: boolean }>(
          "select * from public.area_listing_counts order by slug, mode",
        ),
      );
      equal(
        counts.map((row) => [row.slug, row.mode, Number(row.active_count), row.contains_demo_data]),
        (await demoRepository.getAreaModeCounts()).map((entry) => [entry.slug, entry.mode, entry.count, entry.containsDemoData]),
        "area counts",
      );

      const guide = await as(ANON, () => rows<Record<string, string | null>>("select * from public.location_price_guide order by slug"));
      const demoGuide = await demoRepository.getPriceGuide();
      equal(guide.map((row) => row.slug), demoGuide.map((row) => row.slug), "places in the price guide");
      const pairs = [
        ["sale_per_sqft", "salePerSqft"], ["rent_small", "rentSmall"], ["rent_three", "rentThree"],
        ["rent_large", "rentLarge"], ["land_per_katha", "landPerKatha"],
      ] as const;
      const countPairs = [
        ["sale_count", "saleCount"], ["rent_small_count", "rentSmallCount"], ["rent_three_count", "rentThreeCount"],
        ["rent_large_count", "rentLargeCount"], ["land_count", "landCount"],
      ] as const;
      guide.forEach((row, index) => {
        const expected = demoGuide[index];
        for (const [column, key] of countPairs) equal(Number(row[column]), expected[key], `${row.slug} ${column}`);
        for (const [column, key] of pairs) {
          const db = row[column] === null ? null : Number(row[column]);
          const demo = expected[key];
          truthy((db === null && demo === null) || Math.abs((db ?? 0) - (demo ?? 0)) <= 1, `${row.slug} ${column}: db ${db}, demo ${demo}`);
        }
      });

      for (const key of ["dhn-s1", "dhn-s2", "utt-r1", "pur-l1", "gul-r2"]) {
        const slug = listings.find((listing) => listing.key === key)!.slug;
        const fromDb = await as(ANON, () =>
          one<{ id: string; description: string | null; furnishing: string | null; amenities: Array<{ slug: string }>; price_history: Array<{ price: number }> }>(
            "select id, description, furnishing::text, amenities, price_history from public.listing_details where slug = $1",
            [slug],
          ),
        );
        const fromDemo = (await demoRepository.getListingBySlug(slug))!;
        equal(
          [fromDb.id, fromDb.description, fromDb.furnishing, fromDb.amenities.map((a) => a.slug), fromDb.price_history.map((h) => Number(h.price))],
          [fromDemo.id, fromDemo.description, fromDemo.furnishing, fromDemo.amenities.map((a) => a.slug), fromDemo.priceHistory.map((h) => h.price)],
          `listing ${key}`,
        );
      }
      const hidden = await as(ANON, () => one<{ count: string }>("select count(*) from public.listing_details where id = $1", [pendingId]));
      equal(Number(hidden.count), 0, "a listing waiting for review has no public details");
    });

    await test("location search works in Bangla and English, by alternate spelling, and treats % literally", async () => {
      const search = (query: string) =>
        as(ANON, () => rows<{ slug: string }>("select slug from public.search_locations($1)", [query]));
      equal((await search("ধানমন্ডি"))[0]?.slug, "dhanmondi", "Bangla name");
      equal((await search("dhanm"))[0]?.slug, "dhanmondi", "English prefix");
      equal((await search("Chittagong"))[0]?.slug, "chattogram", "old spelling");
      equal((await search("  UTTARA "))[0]?.slug, "uttara", "case and spaces");
      equal((await search("%")).length, 0, "percent sign");
      equal((await search("")).length, 8, "empty query returns popular places, capped");
      truthy((await search("")).every((row) => locations.find((l) => l.slug === row.slug)?.isPopular), "empty query returns only popular places");
    });

    // -----------------------------------------------------------------------
    console.log("\nContent rules for external listings (enforced even for the service role)");

    const portalSourceId = stableUuid("source", "demo-portal-ka");
    const firstPartySourceId = stableUuid("source", "duar");
    const someProperty = stableUuid("property", "dhn-s2");
    const copiedListingId = "11111111-1111-4111-8111-111111111111";

    await test("a copied third-party description is dropped on the way in", async () => {
      await as(SERVICE, () =>
        rows(
          `insert into public.property_listings
             (id, property_id, source_id, origin, purpose, title, slug, description, price, source_url, status)
           values ($1, $2, $3, 'external', 'sale', 'টেস্ট লিস্টিং', 'copied-description-test',
                   'This text was copied from another site.', 5000000, 'https://example.com/x', 'active')`,
          [copiedListingId, someProperty, portalSourceId],
        ),
      );
      const stored = await one<{ description: string | null; published_at: string | null }>(
        "select description, published_at from public.property_listings where id = $1",
        [copiedListingId],
      );
      equal(stored.description, null, "description");
      truthy(stored.published_at !== null, "published_at should be filled when a listing goes active");
    });

    await test("images cannot be attached to an external listing whose source has not allowed them", () =>
      denied(
        SERVICE,
        () =>
          rows(
            "insert into public.listing_images (listing_id, url, rights_status) values ($1, 'https://example.com/a.jpg', 'source_authorized')",
            [copiedListingId],
          ),
        CHECK_VIOLATION,
      ));

    await test("contact details cannot be stored for an external listing", () =>
      denied(
        SERVICE,
        () => rows("insert into public.listing_contacts (listing_id, phone) values ($1, '+8801700000000')", [copiedListingId]),
        CHECK_VIOLATION,
      ));

    await test("an external listing must carry a link to the original", () =>
      denied(
        SERVICE,
        () =>
          rows(
            `insert into public.property_listings (property_id, source_id, origin, purpose, title, slug, price)
             values ($1, $2, 'external', 'sale', 'টেস্ট লিস্টিং', 'no-source-url', 5000000)`,
            [someProperty, portalSourceId],
          ),
        CHECK_VIOLATION,
      ));

    await test("a listing's origin must match the kind of source it names", () =>
      denied(
        SERVICE,
        () =>
          rows(
            `insert into public.property_listings (property_id, source_id, origin, purpose, title, slug, price)
             values ($1, $2, 'first_party', 'sale', 'টেস্ট লিস্টিং', 'origin-mismatch', 5000000)`,
            [someProperty, portalSourceId],
          ),
        CHECK_VIOLATION,
      ));

    await test("a source cannot be switched on until permission is settled", () =>
      denied(
        SERVICE,
        () => rows("update public.sources set active = true where slug = 'demo-source-off'"),
        CHECK_VIOLATION,
      ));

    await test("once a source allows images, an authorised image is accepted", async () => {
      await as(SERVICE, async () => {
        await rows("update public.sources set allow_images = true where id = $1", [portalSourceId]);
        await rows(
          "insert into public.listing_images (listing_id, url, rights_status) values ($1, 'https://example.com/a.jpg', 'source_authorized')",
          [copiedListingId],
        );
      });
      await as(SERVICE, async () => {
        await rows("delete from public.listing_images where listing_id = $1", [copiedListingId]);
        await rows("update public.sources set allow_images = false where id = $1", [portalSourceId]);
      });
    });

    // -----------------------------------------------------------------------
    console.log("\nReal sites: links out only, no listings");

    const bikroyId = stableUuid("source", "bikroy");

    await test("the real sites are registered switched off, with no permission recorded and nothing allowed", async () => {
      const real = await rows<{ slug: string; active: boolean; permission_status: string; anything_allowed: boolean; has_notes: boolean }>(
        `select slug, active, permission_status::text,
                (allow_images or allow_description or allow_contact) as anything_allowed,
                notes like 'Reviewed %' as has_notes
         from public.sources where slug = any($1) order by slug`,
        [externalSites.map((site) => site.slug)],
      );
      equal(real.length, externalSites.length, "real sites");
      for (const site of real) {
        equal(
          { active: site.active, permission: site.permission_status, allowed: site.anything_allowed, notes: site.has_notes },
          { active: false, permission: "not_requested", allowed: false, notes: true },
          site.slug,
        );
      }
    });

    await test("no listing from a real site is stored", async () => {
      const stored = await one<{ count: string }>(
        "select count(*) from public.property_listings l join public.sources s on s.id = l.source_id where s.slug = any($1)",
        [externalSites.map((site) => site.slug)],
      );
      equal(Number(stored.count), 0, "listings from real sites");
    });

    await test("a listing cannot be added for a site that is switched off, even by the service role", () =>
      denied(
        SERVICE,
        () =>
          rows(
            `insert into public.property_listings (property_id, source_id, origin, purpose, title, slug, price, source_url)
             values ($1, $2, 'external', 'rent', 'টেস্ট লিস্টিং', 'real-site-not-enabled', 30000, 'https://bikroy.com/en/ad/example')`,
            [someProperty, bikroyId],
          ),
        CHECK_VIOLATION,
      ));

    await test("a real site cannot be switched on while no permission is recorded", () =>
      denied(SERVICE, () => rows("update public.sources set active = true where id = $1", [bikroyId]), CHECK_VIOLATION));

    await test("visitors read the links out, and they match what demo mode shows", async () => {
      const fromDb = await as(ANON, () =>
        rows<{ id: string; url: string; source_name: string; location_slug: string | null; purpose: string | null; category: string | null }>(
          "select id, url, source_name, location_slug, purpose::text, category::text from public.external_search_links order by sort_order, id",
        ),
      );
      const fromDemo = await demoRepository.getExternalSearchLinks();
      equal(fromDb.length, externalLinks.length, "links");
      equal(
        fromDb.map((link) => [link.id, link.url, link.source_name, link.location_slug, link.purpose, link.category]),
        fromDemo.map((link) => [link.id, link.url, link.sourceName, link.locationSlug, link.purpose, link.category]),
        "links in the database and in demo mode",
      );
      truthy(fromDb.every((link) => link.url.startsWith("https://")), "every link is https");
    });

    await test("visitors cannot add, change or remove links; a link marked as broken disappears", async () => {
      await denied(ANON, () => rows("insert into public.source_links (source_id, url) values ($1, 'https://evil.example/')", [bikroyId]), PERMISSION_DENIED);
      await denied(ANON, () => rows("update public.source_links set url = 'https://evil.example/'"), PERMISSION_DENIED);
      await denied(ANON, () => rows("delete from public.source_links"), PERMISSION_DENIED);
      await denied(SERVICE, () => rows("insert into public.source_links (source_id, url) values ($1, 'http://not-secure.example/')", [bikroyId]), CHECK_VIOLATION);

      const broken = externalLinks[0].id;
      await as(SERVICE, () => rows("update public.source_links set is_working = false where id = $1", [broken]));
      const visible = await as(ANON, () =>
        one<{ in_view: string; in_table: string }>(
          `select (select count(*) from public.external_search_links where id = $1) as in_view,
                  (select count(*) from public.source_links where id = $1) as in_table`,
          [broken],
        ),
      );
      equal(visible, { in_view: "0", in_table: "0" }, "broken link hidden from visitors");
      await as(SERVICE, () => rows("update public.source_links set is_working = true where id = $1", [broken]));
    });

    // -----------------------------------------------------------------------
    console.log("\nSigned-in users");

    const alice = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const bob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const mod = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const boss = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const ALICE: Actor = { kind: "user", id: alice };
    const BOB: Actor = { kind: "user", id: bob };
    const MOD: Actor = { kind: "user", id: mod };
    const BOSS: Actor = { kind: "user", id: boss };

    await test("signing up creates a private profile with the member role, whatever the sign-up form claims", async () => {
      await as(SUPER, () =>
        rows(
          `insert into auth.users (id, email, raw_user_meta_data) values
             ($1, 'alice@example.com', '{"display_name": "Alice", "role": "admin"}'),
             ($2, 'bob@example.com', '{"display_name": "  "}'),
             ($3, 'mod@example.com', '{"display_name": "Mod"}'),
             ($4, 'boss@example.com', '{"display_name": "Boss"}')`,
          [alice, bob, mod, boss],
        ),
      );
      const profiles = await rows<{ id: string; display_name: string | null; role: string }>(
        "select id, display_name, role::text from public.users order by id",
      );
      equal(profiles.length, 4, "profiles");
      equal(profiles[0], { id: alice, display_name: "Alice", role: "member" }, "alice");
      equal(profiles[1].display_name, null, "blank name becomes null");
      // Staff roles are handed out from a trusted context only.
      await as(SUPER, async () => {
        await rows("update public.users set role = 'moderator' where id = $1", [mod]);
        await rows("update public.users set role = 'admin' where id = $1", [boss]);
      });
    });

    await test("a user sees their own profile and nobody else's", async () => {
      const visible = await as(ALICE, () => rows<{ id: string }>("select id from public.users"));
      equal(visible.map((row) => row.id), [alice], "visible profiles");
    });

    await test("a user can edit their name but cannot promote themselves", async () => {
      await as(ALICE, () => rows("update public.users set display_name = 'Alice R.' where id = $1", [alice]));
      await denied(ALICE, () => rows("update public.users set role = 'admin' where id = $1", [alice]), PERMISSION_DENIED);
      await denied(ALICE, () => rows("update public.users set role = 'agent' where id = $1", [alice]), PERMISSION_DENIED);
      const profile = await one<{ display_name: string; role: string }>(
        "select display_name, role::text from public.users where id = $1",
        [alice],
      );
      equal(profile, { display_name: "Alice R.", role: "member" }, "alice after edits");
    });

    await test("a user cannot edit someone else's profile", async () => {
      await as(ALICE, () => rows("update public.users set display_name = 'hacked' where id = $1", [bob]));
      const profile = await one<{ display_name: string | null }>("select display_name from public.users where id = $1", [bob]);
      equal(profile.display_name, null, "bob's name");
    });

    const dhanmondi = stableUuid("location", "dhanmondi");
    let alicePropertyId = "";
    let aliceListingId = "";

    await test("a user can post a listing; it starts unverified, unfeatured and waiting for review", async () => {
      await as(ALICE, async () => {
        const property = await one<{ id: string; created_by: string; is_verified: boolean; owner_user_id: string | null }>(
          `insert into public.properties (location_id, property_type, size_sqft, bedrooms, bathrooms, is_verified, owner_user_id)
           values ($1, 'apartment', 1200, 3, 2, true, $2)
           returning id, created_by, is_verified, owner_user_id`,
          [dhanmondi, alice],
        );
        alicePropertyId = property.id;
        equal(property.created_by, alice, "created_by");
        equal(property.is_verified, false, "property is_verified");
        equal(property.owner_user_id, null, "ownership is not self-declared");

        const listing = await one<{
          id: string;
          status: string;
          is_verified: boolean;
          listed_by_user_id: string;
          view_count: number;
          featured_until: string | null;
        }>(
          `insert into public.property_listings
             (property_id, source_id, origin, purpose, title, slug, price, status, is_verified, view_count, featured_until, listed_by_user_id)
           values ($1, $2, 'first_party', 'rent', 'আমার ফ্ল্যাট', 'alice-flat', 30000, 'active', true, 99999, now() + interval '1 year', $3)
           returning id, status::text, is_verified, listed_by_user_id, view_count, featured_until`,
          [alicePropertyId, firstPartySourceId, bob],
        );
        aliceListingId = listing.id;
        equal(
          { ...listing, id: undefined },
          { id: undefined, status: "pending_review", is_verified: false, listed_by_user_id: alice, view_count: 0, featured_until: null },
          "listing after insert",
        );
      });
    });

    await test("the pending listing is visible to its lister only", async () => {
      const count = (actor: Actor) =>
        as(actor, () => one<{ count: string }>("select count(*) from public.property_listings where id = $1", [aliceListingId])).then(
          (row) => Number(row.count),
        );
      equal(await count(ALICE), 1, "alice");
      equal(await count(BOB), 0, "bob");
      equal(await count(ANON), 0, "anon");
    });

    await test("a lister cannot approve, verify, feature or re-source their own listing", async () => {
      const attempt = (set: string, sqlstate: string | string[] = PERMISSION_DENIED) =>
        denied(ALICE, () => rows(`update public.property_listings set ${set} where id = $1`, [aliceListingId]), sqlstate);
      await attempt("status = 'active'");
      await attempt("is_verified = true");
      await attempt("featured_until = now() + interval '30 days'");
      await attempt("view_count = 5000");
      await attempt("previous_price = 90000");
      // Refused by the content rule (origin must match the source) before the guard even runs.
      await attempt("origin = 'external', source_url = 'https://example.com'", [PERMISSION_DENIED, CHECK_VIOLATION]);
      await attempt("last_checked_at = now() + interval '1 day'");
    });

    await test("a user cannot post an external listing", () =>
      denied(
        ALICE,
        () =>
          rows(
            `insert into public.property_listings (property_id, source_id, origin, purpose, title, slug, price, source_url)
             values ($1, $2, 'external', 'rent', 'টেস্ট লিস্টিং', 'alice-external', 30000, 'https://example.com/y')`,
            [alicePropertyId, portalSourceId],
          ),
        PERMISSION_DENIED,
      ));

    await test("changing the price records the old price and a history row", async () => {
      await as(ALICE, () => rows("update public.property_listings set price = 27000 where id = $1", [aliceListingId]));
      const listing = await one<{ price: string; previous_price: string; changed: boolean }>(
        "select price, previous_price, price_changed_at is not null as changed from public.property_listings where id = $1",
        [aliceListingId],
      );
      equal(listing, { price: "27000.00", previous_price: "30000.00", changed: true }, "listing price fields");
      const history = await rows<{ price: string }>(
        "select price from public.price_history where listing_id = $1 order by recorded_at",
        [aliceListingId],
      );
      equal(history.map((row) => row.price), ["30000.00", "27000.00"], "price history");
    });

    await test("another user cannot change or delete the listing", async () => {
      await as(BOB, async () => {
        await rows("update public.property_listings set price = 1 where id = $1", [aliceListingId]);
        await rows("delete from public.property_listings where id = $1", [aliceListingId]);
      });
      const listing = await one<{ price: string }>("select price from public.property_listings where id = $1", [aliceListingId]);
      equal(listing.price, "27000.00", "price untouched");
    });

    await test("exact address and contact details are readable by the lister only", async () => {
      await as(ALICE, async () => {
        await rows("insert into public.property_private (property_id, address_line) values ($1, 'House 1, Road 2')", [alicePropertyId]);
        await rows("insert into public.listing_contacts (listing_id, phone, show_phone) values ($1, '+8801700000001', true)", [aliceListingId]);
      });
      const seen = (actor: Actor) =>
        as(actor, () =>
          one<{ addresses: string; contacts: string }>(
            "select (select count(*) from public.property_private) as addresses, (select count(*) from public.listing_contacts) as contacts",
          ),
        );
      equal(await seen(ALICE), { addresses: "1", contacts: "1" }, "alice");
      equal(await seen(BOB), { addresses: "0", contacts: "0" }, "bob");
      await denied(BOB, () => rows("insert into public.listing_contacts (listing_id, phone) values ($1, '+8801700000002')", [visibleFirstPartyId]), PERMISSION_DENIED);
    });

    await test("favourites and saved searches are private to each user", async () => {
      await as(ALICE, async () => {
        await rows("insert into public.favorites (user_id, listing_id) values ($1, $2)", [alice, visibleFirstPartyId]);
        await rows(`insert into public.saved_searches (user_id, name, filters) values ($1, 'ধানমন্ডি ভাড়া', '{"location": "dhanmondi"}')`, [alice]);
      });
      const bobSees = await as(BOB, () =>
        one<{ favorites: string; searches: string }>(
          "select (select count(*) from public.favorites) as favorites, (select count(*) from public.saved_searches) as searches",
        ),
      );
      equal(bobSees, { favorites: "0", searches: "0" }, "bob");
      await denied(BOB, () => rows("insert into public.favorites (user_id, listing_id) values ($1, $2)", [alice, externalId]), PERMISSION_DENIED);
      // Bob cannot see Alice's pending listing, so he cannot favourite it either.
      await denied(BOB, () => rows("insert into public.favorites (user_id, listing_id) values ($1, $2)", [bob, aliceListingId]), PERMISSION_DENIED);
    });

    await test("uploads are confined to the uploader's own folder", async () => {
      await as(ALICE, () =>
        rows("insert into storage.objects (bucket_id, name, owner) values ('listing-images', $1, $2)", [`${alice}/flat/01.webp`, alice]),
      );
      await denied(
        ALICE,
        () => rows("insert into storage.objects (bucket_id, name, owner) values ('listing-images', $1, $2)", [`${bob}/flat/01.webp`, alice]),
        PERMISSION_DENIED,
      );
      await as(ALICE, () =>
        rows("insert into storage.objects (bucket_id, name, owner) values ('verification-docs', $1, $2)", [`${alice}/deed.pdf`, alice]),
      );
      const bobSees = await as(BOB, () => one<{ count: string }>("select count(*) from storage.objects where bucket_id = 'verification-docs'"));
      equal(Number(bobSees.count), 0, "bob cannot see alice's documents");
    });

    // -----------------------------------------------------------------------
    console.log("\nStaff");

    await test("a moderator can approve a listing; it then becomes public", async () => {
      await as(MOD, () =>
        rows("update public.property_listings set status = 'active', is_verified = true, verified_at = now() where id = $1", [aliceListingId]),
      );
      const visible = await as(ANON, () =>
        one<{ count: string }>("select count(*) from public.listing_cards where id = $1 and published_at is not null", [aliceListingId]),
      );
      equal(Number(visible.count), 1, "visible to visitors");
    });

    await test("after approval the lister can mark it rented, but cannot undo a staff rejection", async () => {
      await as(ALICE, () => rows("update public.property_listings set status = 'rented' where id = $1", [aliceListingId]));
      await as(MOD, () => rows("update public.property_listings set status = 'rejected' where id = $1", [aliceListingId]));
      await denied(ALICE, () => rows("update public.property_listings set status = 'pending_review' where id = $1", [aliceListingId]), PERMISSION_DENIED);
      await as(MOD, () => rows("update public.property_listings set status = 'active' where id = $1", [aliceListingId]));
    });

    await test("inquiries reach the lister and stay between the two parties", async () => {
      await as(BOB, () =>
        rows(
          "insert into public.inquiries (listing_id, sender_user_id, sender_name, message, recipient_user_id, status) values ($1, $2, 'Bob', 'এখনো খালি আছে?', $2, 'closed')",
          [aliceListingId, bob],
        ),
      );
      const stored = await one<{ recipient_user_id: string; status: string }>(
        "select recipient_user_id, status::text from public.inquiries where listing_id = $1",
        [aliceListingId],
      );
      equal(stored, { recipient_user_id: alice, status: "new" }, "inquiry routing");
      const count = (actor: Actor) =>
        as(actor, () => one<{ count: string }>("select count(*) from public.inquiries")).then((row) => Number(row.count));
      equal(await count(ALICE), 1, "alice (recipient)");
      equal(await count(BOB), 1, "bob (sender)");
      equal(await count(MOD), 1, "moderator");
      await denied(
        BOB,
        () => rows("insert into public.inquiries (listing_id, sender_user_id, sender_name, message) values ($1, $2, 'Bob', 'hello')", [externalId, bob]),
        CHECK_VIOLATION,
      );
      await denied(
        BOB,
        () => rows("insert into public.inquiries (listing_id, sender_user_id, sender_name, message) values ($1, $2, 'Alice', 'hello')", [aliceListingId, alice]),
        PERMISSION_DENIED,
      );
    });

    await test("only staff can read full source records", async () => {
      const full = await as(MOD, () => rows<{ notes: string }>("select notes from public.staff_list_sources()"));
      truthy(full.length >= 5 && full.every((row) => typeof row.notes === "string"), "moderator reads notes");
      await denied(ALICE, () => rows("select * from public.staff_list_sources()"), PERMISSION_DENIED);
      await denied(ANON, () => rows("select * from public.staff_list_sources()"), PERMISSION_DENIED);
      await denied(ALICE, () => rows("select notes from public.sources"), PERMISSION_DENIED);
    });

    await test("ordinary users cannot edit links out; a moderator can add one and retire it", async () => {
      await as(ALICE, () => rows("update public.source_links set sort_order = 1"));
      const untouched = await one<{ count: string }>("select count(*) from public.source_links where sort_order = 1");
      equal(Number(untouched.count), 0, "links changed by an ordinary user");
      await denied(ALICE, () => rows("insert into public.source_links (source_id, url) values ($1, 'https://bikroy.com/x')", [bikroyId]), PERMISSION_DENIED);

      await as(MOD, () => rows("insert into public.source_links (source_id, url, purpose) values ($1, 'https://bikroy.com/new-builds', 'sale')", [bikroyId]));
      await as(MOD, () => rows("update public.source_links set is_working = false where url = 'https://bikroy.com/new-builds'"));
      const modSees = await as(MOD, () => one<{ count: string }>("select count(*) from public.source_links where url = 'https://bikroy.com/new-builds'"));
      equal(Number(modSees.count), 1, "staff still see a retired link");
      await as(SERVICE, () => rows("delete from public.source_links where url = 'https://bikroy.com/new-builds'"));
    });

    await test("only an admin can manage sources", async () => {
      await as(MOD, () => rows("update public.sources set name = 'changed by moderator' where slug = 'demo-portal-kha'"));
      const afterMod = await one<{ name: string }>("select name from public.sources where slug = 'demo-portal-kha'");
      truthy(afterMod.name !== "changed by moderator", "moderator must not be able to edit sources");
      await as(BOSS, () => rows("update public.sources set active = false where slug = 'demo-portal-kha'"));
      const afterBoss = await one<{ active: boolean }>("select active from public.sources where slug = 'demo-portal-kha'");
      equal(afterBoss.active, false, "admin disabled the source");
      await as(BOSS, () => rows("update public.sources set active = true where slug = 'demo-portal-kha'"));
    });

    await test("a moderator cannot create admins; an admin can change roles", async () => {
      await denied(MOD, () => rows("update public.users set role = 'admin' where id = $1", [mod]), PERMISSION_DENIED);
      await as(BOSS, () => rows("update public.users set role = 'agent' where id = $1", [bob]));
      const profile = await one<{ role: string }>("select role::text from public.users where id = $1", [bob]);
      equal(profile.role, "agent", "bob's role");
    });

    await test("ownership claims: the applicant files one, cannot approve it, and staff review it", async () => {
      await as(BOB, () =>
        rows(
          "insert into public.verification_records (type, property_id, requested_by, applicant_note) values ('ownership_claim', $1, $2, 'এটি আমার ফ্ল্যাট')",
          [someProperty, bob],
        ),
      );
      await denied(
        BOB,
        () =>
          rows(
            "insert into public.verification_records (type, property_id, requested_by, status) values ('ownership_claim', $1, $2, 'approved')",
            [someProperty, bob],
          ),
        PERMISSION_DENIED,
      );
      await denied(
        BOB,
        () => rows("insert into public.verification_records (type, property_id, requested_by) values ('ownership_claim', $1, $2)", [someProperty, alice]),
        PERMISSION_DENIED,
      );
      const aliceSees = await as(ALICE, () => one<{ count: string }>("select count(*) from public.verification_records"));
      equal(Number(aliceSees.count), 0, "other users cannot see the claim");
      await as(BOB, () => rows("update public.verification_records set status = 'approved' where requested_by = $1", [bob]));
      const stillPending = await one<{ status: string }>("select status::text from public.verification_records where requested_by = $1", [bob]);
      equal(stillPending.status, "pending", "applicant cannot approve their own claim");
      await as(MOD, () =>
        rows("update public.verification_records set status = 'approved', reviewed_by = $1, reviewed_at = now() where requested_by = $2", [mod, bob]),
      );
      await denied(SUPER, () => rows("insert into public.verification_records (type, requested_by) values ('ownership_claim', $1)", [bob]), CHECK_VIOLATION);
    });

    await test("duplicate candidates are staff-only and stored once per pair", async () => {
      const [a, b] = [visibleFirstPartyId, externalId].sort();
      await as(MOD, () =>
        rows(
          `insert into public.listing_duplicates (listing_a_id, listing_b_id, confidence, signals) values ($1, $2, 87, '{"location": 1, "size": 0.9}')`,
          [a, b],
        ),
      );
      await denied(MOD, () => rows("insert into public.listing_duplicates (listing_a_id, listing_b_id, confidence) values ($1, $2, 50)", [b, a]), CHECK_VIOLATION);
      const aliceSees = await as(ALICE, () => one<{ count: string }>("select count(*) from public.listing_duplicates"));
      equal(Number(aliceSees.count), 0, "users cannot see duplicate candidates");
    });

    // -----------------------------------------------------------------------
    console.log("\nImpossible values are rejected");

    await test("negative prices, 99-bedroom flats, out-of-country pins and floor 12 of 5", async () => {
      await denied(SUPER, () => rows("update public.property_listings set price = -5 where id = $1", [externalId]), CHECK_VIOLATION);
      await denied(SUPER, () => rows("update public.properties set bedrooms = 99 where id = $1", [someProperty]), CHECK_VIOLATION);
      await denied(SUPER, () => rows("update public.properties set latitude = 51.5, longitude = 0.1 where id = $1", [someProperty]), CHECK_VIOLATION);
      await denied(SUPER, () => rows("update public.properties set floor_number = 12, total_floors = 5 where id = $1", [someProperty]), CHECK_VIOLATION);
      await denied(SUPER, () => rows("update public.properties set size_sqft = 0 where id = $1", [someProperty]), CHECK_VIOLATION);
    });

    // -----------------------------------------------------------------------
    console.log("\nList your property: submissions, photos and review");

    const submission = (overrides: Record<string, unknown> = {}) => ({
      purpose: "rent",
      property_type: "apartment",
      location_slug: "uttara",
      address_line: "House 12, Road 5, Sector 7",
      price: 32000,
      price_negotiable: true,
      size_sqft: 1250,
      bedrooms: 3,
      bathrooms: 2,
      balconies: 2,
      floor_number: 4,
      total_floors: 6,
      furnishing: "semi_furnished",
      parking_spaces: 1,
      amenities: ["lift", "generator"],
      title: "৩ বেডের ফ্ল্যাট",
      slug: `3-bedroom-apartment-for-rent-${Math.random().toString(36).slice(2, 8)}`,
      description: "দক্ষিণমুখী, খোলামেলা।",
      lister_type: "owner",
      contact_name: "Bob",
      phone: "01712345678",
      // Things a lister must not be able to set this way:
      status: "active",
      is_verified: true,
      ...overrides,
    });
    const submit = (actor: Actor, overrides: Record<string, unknown> = {}) =>
      as(actor, () => one<{ listing_id: string; listing_slug: string }>("select * from public.submit_listing($1::jsonb)", [JSON.stringify(submission(overrides))]));
    let bobListing = "";

    await test("visitors cannot submit listings", () =>
      denied(ANON, () => rows("select * from public.submit_listing($1::jsonb)", [JSON.stringify(submission())]), PERMISSION_DENIED));

    await test("a signed-in user's submission waits for review, belongs to them, and keeps address and phone private", async () => {
      bobListing = (await submit(BOB)).listing_id;
      const stored = await one<Record<string, unknown>>(
        `select l.status::text, l.origin::text, l.listed_by_user_id, l.is_verified, l.lister_type::text, l.price_negotiable,
                p.created_by, p.location_precision::text, p.latitude = loc.latitude and p.longitude = loc.longitude as at_area_centre,
                (select array_agg(amenity_slug order by amenity_slug) from public.property_amenities where property_id = p.id) as amenities,
                pp.address_line, c.phone, c.show_phone
           from public.property_listings l join public.properties p on p.id = l.property_id
           join public.locations loc on loc.id = p.location_id
           left join public.property_private pp on pp.property_id = p.id
           left join public.listing_contacts c on c.listing_id = l.id
          where l.id = $1`,
        [bobListing],
      );
      equal(
        stored,
        {
          status: "pending_review", origin: "first_party", listed_by_user_id: bob, is_verified: false, lister_type: "owner",
          price_negotiable: true, created_by: bob, location_precision: "area_only", at_area_centre: true,
          amenities: ["generator", "lift"], address_line: "House 12, Road 5, Sector 7", phone: "01712345678", show_phone: false,
        },
        "stored submission",
      );
      const seen = await as(ANON, () =>
        one<{ cards: string; contacts: string }>(
          `select (select count(*) from public.listing_cards where id = $1) as cards,
                  (select count(*) from public.listing_details where id = $1) as contacts`,
          [bobListing],
        ),
      );
      equal(seen, { cards: "0", contacts: "0" }, "visitors see nothing before approval");
      await denied(ANON, () => rows("select * from public.my_listings"), PERMISSION_DENIED);
    });

    await test("a submission must be placed in an area or city, not a whole district", async () => {
      await denied(BOB, () => submit(BOB, { location_slug: "dhaka-district" }), "22023");
      await denied(BOB, () => submit(BOB, { location_slug: "nowhere" }), "22023");
    });

    await test("my_listings shows each user only their own listings; staff see all", async () => {
      const aliceSees = await as(ALICE, () => rows<{ listed_by_user_id: string }>("select listed_by_user_id from public.my_listings"));
      truthy(aliceSees.every((row) => row.listed_by_user_id === alice), "alice sees only her own");
      const bobSees = await as(BOB, () => rows<{ id: string }>("select id from public.my_listings"));
      truthy(bobSees.some((row) => row.id === bobListing), "bob sees his pending listing");
      const modSees = await as(MOD, () => rows<{ id: string }>("select id from public.my_listings where status = 'pending_review'"));
      truthy(modSees.some((row) => row.id === bobListing), "the moderator sees it in the queue");
      const aliceContacts = await as(ALICE, () => one<{ count: string }>("select count(*) from public.listing_contacts where listing_id = $1", [bobListing]));
      equal(Number(aliceContacts.count), 0, "another user cannot read the phone number");
    });

    await test("a photo must be the lister's own upload for that listing, from our bucket, at most 8", async () => {
      const folder = `${bob}/${bobListing}`;
      const url = (path: string) => `https://project.supabase.co/storage/v1/object/public/listing-images/${path}`;
      const photo = (path: string, link = url(path)) =>
        rows("insert into public.listing_images (listing_id, url, storage_path, rights_status, sort_order) values ($1, $2, $3, 'owned', 0)", [bobListing, link, path]);
      // Not uploaded yet.
      await denied(BOB, () => photo(`${folder}/1.webp`), CHECK_VIOLATION);
      await as(SUPER, async () => {
        for (let n = 1; n <= 9; n += 1) await rows("insert into storage.objects (bucket_id, name, owner) values ('listing-images', $1, $2)", [`${folder}/${n}.webp`, bob]);
        await rows("insert into storage.objects (bucket_id, name, owner) values ('listing-images', $1, $2)", [`${alice}/${bobListing}/x.webp`, alice]);
      });
      await denied(BOB, () => photo(`${alice}/${bobListing}/x.webp`), CHECK_VIOLATION);
      await denied(BOB, () => photo(`${folder}/1.webp`, "https://evil.example/listing-images/1.webp"), CHECK_VIOLATION);
      await denied(BOB, () => rows("insert into public.listing_images (listing_id, url, rights_status) values ($1, 'https://evil.example/a.jpg', 'owned')", [bobListing]), CHECK_VIOLATION);
      await denied(
        BOB,
        () => rows("insert into public.listing_images (listing_id, url, storage_path, rights_status) values ($1, $2, $3, 'source_authorized')", [bobListing, url(`${folder}/1.webp`), `${folder}/1.webp`]),
        CHECK_VIOLATION,
      );
      for (let n = 1; n <= 8; n += 1) await as(BOB, () => photo(`${folder}/${n}.webp`));
      await denied(BOB, () => photo(`${folder}/9.webp`), CHECK_VIOLATION);
      await denied(ALICE, () => photo(`${folder}/9.webp`), ["42501", CHECK_VIOLATION]);
    });

    await test("once approved, the listing is public with its first photo; the lister can mark it rented but not reopen it", async () => {
      await denied(BOB, () => rows("update public.property_listings set status = 'active' where id = $1", [bobListing]), PERMISSION_DENIED);
      await as(MOD, () => rows("update public.property_listings set status = 'active' where id = $1", [bobListing]));
      const card = await as(ANON, () => one<{ image_url: string; status: string }>("select image_url, status::text from public.listing_cards where id = $1", [bobListing]));
      equal(card, { image_url: `https://project.supabase.co/storage/v1/object/public/listing-images/${bob}/${bobListing}/1.webp`, status: "active" }, "public card");
      const details = await as(ANON, () => one<Record<string, unknown>>("select * from public.listing_details where id = $1", [bobListing]));
      truthy(!("phone" in details) && !("address_line" in details) && !("listed_by_user_id" in details), "no private columns in the public details");
      await as(BOB, () => rows("update public.property_listings set status = 'rented' where id = $1", [bobListing]));
      await denied(BOB, () => rows("update public.property_listings set status = 'active' where id = $1", [bobListing]), PERMISSION_DENIED);
    });

    await test("one account can submit at most 10 listings a day", async () => {
      for (let n = 0; n < 9; n += 1) await submit(BOB);
      try {
        await submit(BOB);
        throw new Error("the 11th submission was accepted");
      } catch (error) {
        equal((error as { hint?: string }).hint, "daily_limit", "refusal reason");
      }
      await as(SUPER, () => rows("delete from public.property_listings where listed_by_user_id = $1 and status = 'pending_review'", [bob]));
    });

    // -----------------------------------------------------------------------
    console.log("\nDuplicates: suggested by the database, merged by staff");

    const uttR2 = stableUuid("listing", "utt-r2");
    const uttR2d = stableUuid("listing", "utt-r2d");
    const pairOf = async () =>
      as(SUPER, () =>
        one<{ id: string; status: string; confidence: string; signals: Record<string, unknown> }>(
          "select id, status::text, confidence, signals from public.listing_duplicates where listing_a_id = least($1::uuid, $2::uuid) and listing_b_id = greatest($1::uuid, $2::uuid)",
          [uttR2, uttR2d],
        ),
      );
    const uttaraRentCount = async () =>
      Number((await as(ANON, () => one<{ active_count: string }>("select active_count from public.area_listing_counts where slug = 'uttara' and mode = 'rent'"))).active_count);

    await test("visitors and ordinary users cannot look for, merge or split duplicates, or see the queue", async () => {
      await denied(ANON, () => rows("select public.find_duplicate_candidates()"), PERMISSION_DENIED);
      await denied(ALICE, () => rows("select public.find_duplicate_candidates()"), PERMISSION_DENIED);
      await denied(ALICE, () => rows("select public.split_listing($1)", [uttR2]), PERMISSION_DENIED);
      await denied(ANON, () => rows("select * from public.duplicate_review"), PERMISSION_DENIED);
      const seen = await as(ALICE, () => rows("select * from public.duplicate_review"));
      equal(seen.length, 0, "rows an ordinary user sees in the queue");
    });

    await test("staff find the likely pair, once, and never a pair that is already one property", async () => {
      const added = await as(MOD, () => one<{ n: number }>("select public.find_duplicate_candidates() as n"));
      truthy(added.n >= 1, `expected at least one suggestion, got ${added.n}`);
      const pair = await pairOf();
      equal(pair.status, "pending", "status");
      truthy(Number(pair.confidence) >= 60, `confidence ${pair.confidence}`);
      equal(pair.signals.same_source, false, "signals record the sources differ");
      const again = await as(MOD, () => one<{ n: number }>("select public.find_duplicate_candidates() as n"));
      equal(again.n, 0, "a second run adds nothing");
      const samePropertyPairs = await as(SUPER, () =>
        one<{ count: string }>(
          `select count(*) from public.listing_duplicates d
           join public.property_listings a on a.id = d.listing_a_id join public.property_listings b on b.id = d.listing_b_id
           where a.property_id = b.property_id`,
        ),
      );
      equal(Number(samePropertyPairs.count), 0, "pairs already on one property");
      const queue = await as(MOD, () => rows<{ id: string }>("select id from public.duplicate_review where status = 'pending'"));
      truthy(queue.some((row) => row.id === pair.id), "the pair is in the staff queue");
    });

    await test("merging shows the pair as one card, counted once; splitting undoes it", async () => {
      const before = await uttaraRentCount();
      const pair = await pairOf();
      await denied(ALICE, () => rows("select public.resolve_duplicate($1, 'merged')", [pair.id]), PERMISSION_DENIED);
      await as(MOD, () => rows("select public.resolve_duplicate($1, 'merged')", [pair.id]));
      const cards = await as(ANON, () =>
        rows<{ id: string; property_id: string; is_group_lead: boolean; also_listed_count: number; group_min_price: string | null }>(
          "select id, property_id, is_group_lead, also_listed_count, group_min_price from public.listing_cards where id in ($1, $2) order by price",
          [uttR2, uttR2d],
        ),
      );
      equal(cards[0].property_id, cards[1].property_id, "one property");
      equal(cards.map((card) => card.is_group_lead), [true, false], "the cheaper listing leads");
      equal(cards.map((card) => card.also_listed_count), [1, 1], "each knows about the other");
      equal(Number(cards[0].group_min_price), 24_000, "lowest price");
      equal(await uttaraRentCount(), before - 1, "Uttara rent count");
      equal((await pairOf()).status, "merged", "pair status");

      await as(MOD, () => rows("select public.split_listing($1)", [uttR2d]));
      const after = await as(ANON, () =>
        rows<{ property_id: string; is_group_lead: boolean }>("select property_id, is_group_lead from public.listing_cards where id in ($1, $2)", [uttR2, uttR2d]),
      );
      truthy(after[0].property_id !== after[1].property_id && after.every((card) => card.is_group_lead), "two properties again");
      equal(await uttaraRentCount(), before, "count restored");
      equal((await pairOf()).status, "review_later", "the pair is open for review again");
      await denied(MOD, () => rows("select public.split_listing($1)", [uttR2d]), "22023");
    });

    await test("a rejected pair is not suggested again", async () => {
      const pair = await pairOf();
      await as(MOD, () => rows("select public.resolve_duplicate($1, 'rejected')", [pair.id]));
      await as(MOD, () => rows("select public.find_duplicate_candidates()"));
      equal((await pairOf()).status, "rejected", "still rejected");
    });

    // -----------------------------------------------------------------------
    console.log("\nPrice-drop alerts");

    const basS1 = stableUuid("listing", "bas-s1");
    const basS1x = stableUuid("listing", "bas-s1x");
    const priceOf = async (id: string) => Number((await as(SUPER, () => one<{ price: string }>("select price from public.property_listings where id = $1", [id]))).price);

    await test("saving a listing records its real price, whatever the client sends", async () => {
      await as(ALICE, () => rows("insert into public.favorites (user_id, listing_id, saved_price) values ($1, $2, 1)", [alice, uttR2]));
      await as(ALICE, () => rows("insert into public.favorites (user_id, listing_id) values ($1, $2)", [alice, basS1]));
      const saved = await as(ALICE, () =>
        rows<{ id: string; saved_price: string; price: string }>("select id, saved_price, price from public.my_saved_listings where id in ($1, $2)", [uttR2, basS1]),
      );
      equal(saved.length, 2, "saved listings");
      truthy(saved.every((row) => Number(row.saved_price) === Number(row.price)), "saved price is the listing's price");
      equal((await as(BOB, () => rows("select * from public.my_saved_listings"))).length, 0, "bob sees none of alice's");
      await denied(ALICE, () => rows("insert into public.favorites (user_id, listing_id) values ($1, $2)", [bob, uttR2]), PERMISSION_DENIED);
      await denied(ANON, () => rows("select * from public.my_saved_listings"), PERMISSION_DENIED);
    });

    await test("a price drop alerts everyone who saved the property, once; a rise alerts no one", async () => {
      const old = await priceOf(uttR2);
      await as(SERVICE, () => rows("update public.property_listings set price = $2 where id = $1", [uttR2, old - 2000]));
      await as(SERVICE, () => rows("update public.property_listings set price = $2 where id = $1", [uttR2, old + 1000]));
      // The other site's listing of the same flat as bas-s1 gets cheaper: alice saved bas-s1, so she hears about it.
      const otherOld = await priceOf(basS1x);
      await as(SERVICE, () => rows("update public.property_listings set price = $2 where id = $1", [basS1x, otherOld - 300_000]));

      const alerts = await as(ALICE, () =>
        rows<{ listing_id: string; old_price: string; new_price: string; read_at: string | null; slug: string }>(
          "select listing_id, old_price, new_price, read_at, slug from public.my_notifications order by created_at, listing_id",
        ),
      );
      equal(
        alerts.map((a) => [a.listing_id, Number(a.old_price), Number(a.new_price), a.read_at]).sort(),
        [[uttR2, old, old - 2000, null], [basS1x, otherOld, otherOld - 300_000, null]].sort(),
        "alice's alerts",
      );
      equal((await as(BOB, () => rows("select * from public.my_notifications"))).length, 0, "bob saved nothing, so has no alerts");
      await denied(ANON, () => rows("select * from public.notifications"), PERMISSION_DENIED);
    });

    await test("a user can mark their alerts read and delete them, but not write or change them", async () => {
      await denied(ALICE, () => rows("insert into public.notifications (user_id, listing_id, old_price, new_price) values ($1, $2, 2, 1)", [alice, uttR2]), PERMISSION_DENIED);
      await denied(ALICE, () => rows("update public.notifications set new_price = 1 where user_id = $1", [alice]), PERMISSION_DENIED);
      await as(BOB, () => rows("update public.notifications set read_at = now() where user_id = $1", [alice]));
      const stillUnread = await as(SUPER, () => one<{ count: string }>("select count(*) from public.notifications where user_id = $1 and read_at is null", [alice]));
      equal(Number(stillUnread.count), 2, "bob cannot mark alice's alerts read");
      await as(ALICE, () => rows("update public.notifications set read_at = now() where read_at is null"));
      const unread = await as(ALICE, () => one<{ count: string }>("select count(*) from public.notifications where read_at is null"));
      equal(Number(unread.count), 0, "unread after marking");
      await as(ALICE, () => rows("delete from public.notifications"));
      equal((await as(ALICE, () => rows("select * from public.my_notifications"))).length, 0, "deleted");
      await as(ALICE, () => rows("delete from public.favorites"));
    });

    // -----------------------------------------------------------------------
    console.log("\nRemoving demo data");

    await test("remove_demo_data.sql deletes every demo row and nothing else", async () => {
      await as(SERVICE, () => rows("delete from public.property_listings where id = $1", [copiedListingId]));
      await runSqlFile(resolve(root, "supabase/remove_demo_data.sql"));
      const left = await one<{ demo_listings: string; demo_properties: string; demo_sources: string; locations: string; real_listings: string; sources: string; links: string }>(
        `select
           (select count(*) from public.property_listings where is_demo) as demo_listings,
           (select count(*) from public.properties where is_demo) as demo_properties,
           (select count(*) from public.sources where is_demo) as demo_sources,
           (select count(*) from public.locations) as locations,
           (select count(*) from public.property_listings where id = $1) as real_listings,
           (select count(*) from public.sources) as sources,
           (select count(*) from public.source_links) as links`,
        [aliceListingId],
      );
      equal(
        left,
        { demo_listings: "0", demo_properties: "0", demo_sources: "0", locations: String(LOCATIONS.length), real_listings: "1", sources: String(1 + externalSites.length), links: String(externalLinks.length) },
        "after cleanup",
      );
    });
  } finally {
    await db.end();
    await admin.query(`drop database if exists ${databaseName} with (force)`);
    await admin.end();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(failures.map((name) => `  - ${name}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
