import { createAreaPage } from "@/components/area/area-page";

/** /commercial/{place}. See src/components/area/area-page.tsx. */
const page = createAreaPage("commercial");

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
