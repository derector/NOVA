import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { httpsUrl } from "../lib/release.js";

const source = new URL("../src/", import.meta.url);
const output = new URL("../dist/", import.meta.url);

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function optionalOrigin(variable) {
  const value = process.env[variable];
  if (!value) return null;
  const parsed = httpsUrl(value);
  if (!parsed || parsed.pathname !== "/" || parsed.search) throw new Error(`${variable} must be an HTTPS origin`);
  return parsed.origin;
}

async function galleryMarkup() {
  let entries;
  try {
    entries = JSON.parse(await readFile(new URL("screenshots.json", source), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
  const screenshots = await Promise.all(entries.map(async ({ file, alt, caption, width, height }) => {
    if (
      !/^[\w-]+\.(png|webp)$/.test(file) ||
      !(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0) ||
      typeof alt !== "string" || !alt.trim() || typeof caption !== "string" || !caption.trim()
    ) throw new Error("Invalid APK screenshot entry");
    await mkdir(new URL("screenshots/", output), { recursive: true });
    await cp(new URL(`screenshots/${file}`, source), new URL(`screenshots/${file}`, output));
    return `<figure class="glass"><img loading="lazy" src="/screenshots/${file}" width="${width}" height="${height}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
  }));
  return screenshots.length
    ? `<section class="gallery" aria-labelledby="gallery-title"><h2 id="gallery-title">Экраны NOVA</h2><div class="gallery-grid">${screenshots.join("")}</div></section>`
    : "";
}

const origin = optionalOrigin("NOVA_DOWNLOAD_ORIGIN");
const messenger = optionalOrigin("NOVA_MESSENGER_ORIGIN");
const indexable = origin && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
const verification = process.env.NOVA_GOOGLE_SITE_VERIFICATION;
if (verification && !/^[\w-]+$/.test(verification)) throw new Error("Invalid NOVA_GOOGLE_SITE_VERIFICATION");

const seo = [
  indexable ? '<meta name="robots" content="index,follow">' : '<meta name="robots" content="noindex,nofollow">',
  origin ? `<link rel="canonical" href="${escapeHtml(origin)}/">` : "",
  origin ? `<meta property="og:url" content="${escapeHtml(origin)}/">` : "",
  indexable && verification ? `<meta name="google-site-verification" content="${verification}">` : ""
].filter(Boolean).join("\n  ");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const asset of ["nova.svg", "styles.css", "release.js"]) {
  await cp(new URL(asset, source), new URL(asset, output));
}

const html = (await readFile(new URL("index.html", source), "utf8"))
  .replace("<!--SEO-->", seo)
  .replace("<!--WEB_LINK-->", messenger ? `<a href="${escapeHtml(messenger)}/">Открыть NOVA</a>` : "")
  .replace("<!--APK_GALLERY-->", await galleryMarkup());

await writeFile(new URL("index.html", output), html);
await writeFile(new URL("robots.txt", output), indexable
  ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`
  : "User-agent: *\nDisallow: /\n");

if (indexable) {
  await writeFile(new URL("sitemap.xml", output), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin)}/</loc></url></urlset>\n`);
}
