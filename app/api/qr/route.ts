import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");
  if (!text || text.length > 500) {
    return NextResponse.json(
      { error: "QRコードにするURLが不正です" },
      { status: 422 },
    );
  }

  const png = await QRCode.toBuffer(text, {
    type: "png",
    width: 640,
    margin: 1,
    color: { dark: "#000437", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
