export const PACKAGE_NAME = "io.nova.app";
export const SHA_256 = /^[\da-f]{64}$/i;
const MAX_ANDROID_VERSION_CODE = 2_147_483_647;
const MAX_APK_SIZE_BYTES = 256 * 1024 * 1024;

export function httpsUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url : null;
  } catch {
    return null;
  }
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function parseRelease(value, expectedSigner) {
  if (!value || value.packageName !== PACKAGE_NAME || !SHA_256.test(expectedSigner ?? "")) return null;

  const apkUrl = httpsUrl(value.apkUrl);
  const apkSha256 = typeof value.apkSha256 === "string" ? value.apkSha256.toLowerCase() : "";
  const signerSha256 = typeof value.signerSha256 === "string" ? value.signerSha256.toLowerCase() : "";
  const { versionCode, versionName, minimumVersionCode, apkSizeBytes } = value;
  const releasedAt = typeof value.releasedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value.releasedAt)
    && Number.isFinite(Date.parse(value.releasedAt)) ? value.releasedAt : undefined;

  if (
    !apkUrl ||
    !positiveInteger(versionCode) ||
    versionCode > MAX_ANDROID_VERSION_CODE ||
    !Number.isSafeInteger(minimumVersionCode) || minimumVersionCode < 0 ||
    minimumVersionCode > versionCode ||
    typeof versionName !== "string" || !/^[0-9][0-9A-Za-z.+-]{0,63}$/.test(versionName) ||
    !positiveInteger(apkSizeBytes) || apkSizeBytes > MAX_APK_SIZE_BYTES ||
    !SHA_256.test(apkSha256) ||
    signerSha256 !== expectedSigner.toLowerCase()
  ) return null;

  return {
    packageName: PACKAGE_NAME,
    versionCode,
    versionName,
    minimumVersionCode,
    apkUrl: apkUrl.href,
    apkSha256,
    apkSizeBytes,
    signerSha256,
    releasedAt
  };
}
