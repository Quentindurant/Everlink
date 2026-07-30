import { handleExportDownload } from "../route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleExportDownload("sda", request);
}
