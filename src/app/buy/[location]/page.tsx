import { createAreaPage } from "@/components/area/area-page";

/** /buy/{place}. See src/components/area/area-page.tsx. */
const page = createAreaPage("buy");

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
