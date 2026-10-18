import { createAreaPage } from "@/components/area/area-page";

/** /rent/{place}. See src/components/area/area-page.tsx. */
const page = createAreaPage("rent");

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
