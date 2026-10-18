import { createAreaPage } from "@/components/area/area-page";

/** /land/{place}. See src/components/area/area-page.tsx. */
const page = createAreaPage("land");

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
