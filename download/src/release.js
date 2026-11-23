const status = document.querySelector("#release-status");
const actions = document.querySelector("#release-actions");
const retry = document.querySelector("#release-retry");
const apk = document.querySelector("#apk-link");
const checks = document.querySelector("#release-checks");

function versionSummary(release) {
  const size = new Intl.NumberFormat("ru", { maximumFractionDigits: 1 }).format(release.apkSizeBytes / 1_048_576);
  const date = release.releasedAt
    ? new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(release.releasedAt))
    : null;
  return [`Версия ${release.versionName}`, `${size} МБ`, date].filter(Boolean).join(" · ");
}

async function checkRelease() {
  status.textContent = "Проверяем публикацию APK…";
  actions.hidden = true;
  retry.hidden = true;
  checks.hidden = true;
  try {
    const response = await fetch("/api/release", { signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) {
      status.textContent = "Подписанная версия APK пока не опубликована.";
      return;
    }
    if (!response.ok) throw new Error("Unavailable");
    const release = await response.json();
    const url = new URL(release.apkUrl);
    if (url.protocol !== "https:") throw new Error("Invalid APK URL");

    document.querySelector("#release-package").textContent = release.packageName;
    document.querySelector("#release-digest").textContent = release.apkSha256;
    document.querySelector("#release-signer").textContent = release.signerSha256;
    apk.href = url.href;
    status.textContent = versionSummary(release);
    actions.hidden = false;
    checks.hidden = false;
  } catch {
    status.textContent = "Не удалось проверить версию APK. Попробуйте ещё раз.";
    retry.hidden = false;
  }
}

retry.addEventListener("click", checkRelease);
checkRelease();
