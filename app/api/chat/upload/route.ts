import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Upload API: accepts multipart/form-data with an 'image' field
// Stores the image as base64 data URL in Neon DB (images are small screenshots)
// Returns a pseudo-URL that the chat display can use directly (data URL)

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
    }

    // Convert to base64 data URL
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (e) {
    console.error("POST /api/chat/upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
