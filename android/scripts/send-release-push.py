"""Verify the published APK and submit a release wake-up signal to FCM."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


from release_apk import MAX_APK_BYTES, PACKAGE_NAME, SHA256, verify_release_apk


TOPIC = "nova-apk-updates"
MAX_MANIFEST_BYTES = 16 * 1024


def require_public_https(url: str) -> str:
    if not isinstance(url, str):
        raise ValueError("Expected a public HTTPS URL")
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or any(character.isspace() for character in url)
    ):
        raise ValueError("Expected a public HTTPS URL")
    return url


class AssetRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require_public_https(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def verify_published_release(
    manifest_url: str, expected_version: int, expected_signer: str, build_tools: Path
) -> None:
    assets = build_opener(AssetRedirects())
    request = Request(require_public_https(manifest_url), headers={"Cache-Control": "no-cache"})
    with assets.open(request, timeout=30) as response:
        manifest = response.read(MAX_MANIFEST_BYTES + 1)
    if len(manifest) > MAX_MANIFEST_BYTES:
        raise ValueError("Published manifest exceeds the size limit")

    release = json.loads(manifest)
    if (
        not isinstance(release, dict)
        or release.get("packageName") != PACKAGE_NAME
        or type(release.get("versionCode")) is not int
        or release.get("versionCode") != expected_version
        or not isinstance(release.get("signerSha256"), str)
        or release["signerSha256"].lower() != expected_signer.lower()
    ):
        raise ValueError("Published manifest does not match the requested signed NOVA release")
    apk_size = release.get("apkSizeBytes")
    apk_sha = release.get("apkSha256")
    if type(apk_size) is not int or not 0 < apk_size <= MAX_APK_BYTES:
        raise ValueError("Published manifest has an invalid APK size")
    if not isinstance(apk_sha, str) or not SHA256.fullmatch(apk_sha):
        raise ValueError("Published manifest has an invalid APK SHA-256")

    digest = hashlib.sha256()
    downloaded = 0
    with TemporaryDirectory(prefix="nova-release-push-") as temporary:
        apk_path = Path(temporary, "release.apk")
        with assets.open(require_public_https(release["apkUrl"]), timeout=30) as response:
            with apk_path.open("wb") as output:
                while chunk := response.read(128 * 1024):
                    downloaded += len(chunk)
                    if downloaded > apk_size:
                        raise ValueError("Published APK exceeds the declared size")
                    digest.update(chunk)
                    output.write(chunk)
        if downloaded != apk_size or digest.hexdigest() != apk_sha.lower():
            raise ValueError("Published APK size or SHA-256 does not match the manifest")
        version_code, version_name = verify_release_apk(apk_path, build_tools, expected_signer)
        if (version_code, version_name) != (expected_version, release.get("versionName")):
            raise ValueError("Published APK version does not match the manifest")


def send_release_signal(project: str, access_token: str, version: int, send: bool) -> None:
    payload = {
        "validate_only": not send,
        "message": {
            "topic": TOPIC,
            "data": {"kind": "nova_release", "versionCode": str(version)},
            "android": {"priority": "NORMAL", "ttl": "86400s", "collapse_key": TOPIC},
        },
    }
    request = Request(
        f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
    )
    # The OAuth bearer token is exclusive to FCM.
    with build_opener(NoRedirects()).open(request, timeout=30) as response:
        receipt = json.load(response)
    if not isinstance(receipt, dict):
        raise ValueError("Invalid response from FCM")
    print(f"FCM accepted the {'release signal' if send else 'validation-only request'}.")
    if receipt.get("name"):
        print(f"FCM message name: {receipt['name']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version-code", type=int, required=True)
    parser.add_argument("--build-tools", type=Path, required=True)
    parser.add_argument("--send", action="store_true", help="Send to subscribers after verification")
    args = parser.parse_args()

    try:
        project = os.environ["NOVA_FIREBASE_PROJECT_ID"]
        signer = os.environ["NOVA_RELEASE_CERT_SHA256"]
        token = os.environ["NOVA_FCM_ACCESS_TOKEN"]
        manifest_url = os.environ["NOVA_UPDATE_MANIFEST_URL"]
        if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project):
            raise ValueError("Invalid Firebase project ID")
        if not SHA256.fullmatch(signer) or not 0 < args.version_code <= 2**31 - 1:
            raise ValueError("Invalid expected APK certificate or version code")
        if not token or any(character.isspace() for character in token):
            raise ValueError("Missing or malformed short-lived FCM access token")
        verify_published_release(manifest_url, args.version_code, signer, args.build_tools)
        send_release_signal(project, token, args.version_code, args.send)
    except (KeyError, TypeError, OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Release push failed: {error}\n")


if __name__ == "__main__":
    main()
