import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRelease } from "../lib/release.js";
import handler from "../api/release.js";

const fingerprint = "a".repeat(64);
const manifest = {
  packageName: "io.nova.app",
  versionCode: 4,
  versionName: "0.1.3",
  minimumVersionCode: 0,
  apkUrl: "https://cdn.example.org/NOVA-0.1.3.apk",
  apkSha256: "b".repeat(64),
  apkSizeBytes: 12_500_000,
  signerSha256: fingerprint,
  releasedAt: "2026-11-23T12:00:00Z"
};

test("accepts the production package with the configured signer", () => {
  assert.deepEqual(parseRelease(manifest, fingerprint.toUpperCase()), manifest);
});

test("rejects unexpected signers, packages, update floors and download URLs", () => {
  for (const override of [
    { signerSha256: "c".repeat(64) },
    { packageName: "io.nova.app.debug" },
    { minimumVersionCode: 5 },
    { minimumVersionCode: -1 },
    { versionCode: 2_147_483_648 },
    { versionName: "alpha" },
    { apkSizeBytes: 268_435_457 },
    { apkSizeBytes: 0 },
    { apkSha256: "" },
    { apkUrl: "http://cdn.example.org/NOVA.apk" },
    { apkUrl: "https://user:password@cdn.example.org/NOVA.apk" }
  ]) {
    assert.equal(parseRelease({ ...manifest, ...override }, fingerprint), null);
  }
  assert.equal(parseRelease(manifest, ""), null);
});

function responseStub() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
}

test("serves the linked release and handles upstream failures", async (context) => {
  const backup = {
    NOVA_UPDATE_MANIFEST_URL: process.env.NOVA_UPDATE_MANIFEST_URL,
    NOVA_RELEASE_CERT_SHA256: process.env.NOVA_RELEASE_CERT_SHA256
  };
  context.after(() => {
    for (const [key, value] of Object.entries(backup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  delete process.env.NOVA_UPDATE_MANIFEST_URL;
  delete process.env.NOVA_RELEASE_CERT_SHA256;
  let response = responseStub();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(response.headers["Cache-Control"], "no-store");

  process.env.NOVA_UPDATE_MANIFEST_URL = "https://cdn.example.org/latest.json";
  process.env.NOVA_RELEASE_CERT_SHA256 = fingerprint;
  const fetchMock = context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.href, process.env.NOVA_UPDATE_MANIFEST_URL);
    assert.equal(options.redirect, "error");
    return Response.json(manifest);
  });
  response = responseStub();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, manifest);
  assert.equal(fetchMock.mock.callCount(), 1);

  fetchMock.mock.mockImplementation(async () => Response.json({}, { status: 503 }));
  response = responseStub();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, "RELEASE_UNAVAILABLE");
});
