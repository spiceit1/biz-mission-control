import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const docPath = searchParams.get("path");
  const docId = searchParams.get("id");

  try {
    const sql = getDb();

    if (docPath || docId) {
      let rows;
      if (docId) {
        rows = await sql`SELECT * FROM mc_docs WHERE id = ${docId} LIMIT 1`;
      } else {
        rows = await sql`SELECT * FROM mc_docs WHERE path = ${docPath} LIMIT 1`;
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const r = rows[0];
      return NextResponse.json({
        content: r.content,
        path: r.path,
        size: r.size,
        lastModified: r.last_modified,
        meta: {
          title: r.title,
          category: r.category,
          tags: r.tags,
          date: r.date,
        },
      });
    }

    // Return list of all docs
    const docs = await sql`SELECT id, title, path, category, size, word_count, last_modified, preview, tags, date
      FROM mc_docs ORDER BY category ASC, last_modified DESC`;

    const mapped = docs.map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      path: r.path,
      category: r.category,
      size: r.size,
      wordCount: r.word_count,
      lastModified: r.last_modified,
      preview: r.preview,
      tags: r.tags,
      date: r.date,
    }));

    return NextResponse.json({ docs: mapped });
  } catch (e) {
    console.error("GET /api/docs error:", e);
    return NextResponse.json({ error: "Failed to read docs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, category = "Other", content = "", tags = [] } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const sql = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60)
      .replace(/^-|-$/g, "");

    const id = Buffer.from(`docs/${today}-${slug}.md`).toString("base64url");
    const tagList = Array.isArray(tags)
      ? tags
      : (tags as string)
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

    const tagYaml =
      tagList.length > 0
        ? `[${tagList.map((t: string) => `"${t}"`).join(", ")}]`
        : "[]";

    const frontmatter = `---\ntitle: "${title}"\ncategory: "${category}"\ndate: "${today}"\ntags: ${tagYaml}\n---\n\n`;
    const fullContent = frontmatter + content;
    const wordCount = fullContent.split(/\s+/).filter(Boolean).length;
    const preview = content
      .replace(/#+\s*/g, "")
      .replace(/\*\*/g, "")
      .replace(/---/g, "")
      .trim()
      .slice(0, 200);

    const docPath = `/docs/${today}-${slug}.md`;

    await sql`INSERT INTO mc_docs (id, title, path, category, content, size, word_count, last_modified, preview, tags, date, synced_at)
      VALUES (${id}, ${title}, ${docPath}, ${category}, ${fullContent}, ${fullContent.length}, ${wordCount}, NOW(), ${preview}, ${tagList}, ${today}, NOW())
      ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, size=EXCLUDED.size, word_count=EXCLUDED.word_count, last_modified=NOW(), preview=EXCLUDED.preview, synced_at=NOW()`;

    return NextResponse.json({
      success: true,
      path: docPath,
      filename: `${today}-${slug}.md`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/docs error:", message);
    return NextResponse.json({ error: "Failed to create doc", message }, { status: 500 });
  }
}
