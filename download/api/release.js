import { httpsUrl, parseRelease, SHA_256 } from "../lib/release.js";

function respond(response, status, body) {
  response.setHeader("Cache-Control", status === 200 ? "public, max-age=0, s-maxage=60" : "no-store");
  response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return respond(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const manifestUrl = httpsUrl(process.env.NOVA_UPDATE_MANIFEST_URL);
  const signer = process.env.NOVA_RELEASE_CERT_SHA256;
  if (!process.env.NOVA_UPDATE_MANIFEST_URL && !signer) {
    return respond(response, 404, { error: "RELEASE_UNPUBLISHED" });
  }
  if (!manifestUrl || !SHA_256.test(signer ?? "")) {
    return respond(response, 503, { error: "RELEASE_UNAVAILABLE" });
  }

  try {
    const upstream = await fetch(manifestUrl, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000)
    });

    if (upstream.status === 404) return respond(response, 404, { error: "RELEASE_UNPUBLISHED" });
    if (!upstream.ok) return respond(response, 503, { error: "RELEASE_UNAVAILABLE" });

    const release = parseRelease(await upstream.json(), signer);
    if (!release) return respond(response, 503, { error: "RELEASE_UNAVAILABLE" });
    return respond(response, 200, release);
  } catch {
    return respond(response, 503, { error: "RELEASE_UNAVAILABLE" });
  }
}
