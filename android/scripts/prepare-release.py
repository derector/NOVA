"""Verify the signed release APK and prepare files for the public update channel."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit


PACKAGE_NAME = "io.nova.app"
MAX_APK_BYTES = 256 * 1024 * 1024


def prepare_release(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", args.signer_sha256):
        raise ValueError("NOVA_RELEASE_CERT_SHA256 must be a SHA-256 certificate digest")
    public_url = urlsplit(args.apk_base_url)
    if (
        public_url.scheme != "https"
        or not public_url.hostname
        or public_url.username is not None
        or public_url.password is not None
        or public_url.query
        or public_url.fragment
        or any(character.isspace() for character in args.apk_base_url)
    ):
        raise ValueError("NOVA_APK_PUBLIC_BASE_URL must be an HTTPS directory URL")

    badging = subprocess.check_output([args.build_tools / "aapt", "dump", "badging", args.apk], text=True)
    package = re.search(
        r"^package: name='(.*?)' versionCode='([0-9]+)' versionName='(.*?)'", badging, re.MULTILINE
    )
    if not package or package[1] != PACKAGE_NAME or not re.search(r"^sdkVersion:'26'$", badging, re.MULTILINE):
        raise ValueError("Unexpected APK package or minimum SDK")
    version_code = int(package[2])
    version_name = package[3]
    if not re.fullmatch(r"[0-9][0-9A-Za-z.+-]{0,63}", version_name) or args.tag != f"v{version_name}":
        raise ValueError("The release tag must match the APK versionName")
    if not (0 <= args.minimum_version_code <= version_code <= 2**31 - 1 and version_code > 0):
        raise ValueError("Invalid minimum or current versionCode")

    verification = subprocess.check_output(
        [args.build_tools / "apksigner", "verify", "--verbose", "--print-certs", args.apk],
        text=True,
    )
    signers = re.findall(r"^Signer #[0-9]+ certificate SHA-256 digest: ([0-9a-fA-F]{64})$", verification, re.MULTILINE)
    pinned_signer = args.signer_sha256.lower()
    if [signer.lower() for signer in signers] != [pinned_signer] or (
        "Verified using v2 scheme (APK Signature Scheme v2): true" not in verification
    ):
        raise ValueError("APK must match the pinned NOVA certificate and have a valid v2 signature")

    apk_size = args.apk.stat().st_size
    if not 0 < apk_size <= MAX_APK_BYTES:
        raise ValueError("APK size exceeds the update channel limit")
    with args.apk.open("rb") as apk_file:
        apk_hash = hashlib.file_digest(apk_file, "sha256").hexdigest()
    apk_name = f"NOVA-{version_name}-{version_code}.apk"
    metadata = {
        "packageName": PACKAGE_NAME,
        "versionCode": version_code,
        "versionName": version_name,
        "minimumVersionCode": args.minimum_version_code,
        "apkUrl": f"{args.apk_base_url.rstrip('/')}/{apk_name}",
        "apkSha256": apk_hash,
        "apkSizeBytes": apk_size,
        "signerSha256": pinned_signer,
        "releasedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.apk, args.output / apk_name)
    (args.output / "latest.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--build-tools", type=Path, required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--signer-sha256", required=True)
    parser.add_argument("--apk-base-url", required=True)
    parser.add_argument("--minimum-version-code", type=int, default=0)
    parser.add_argument("--output", type=Path, required=True)
    try:
        prepare_release(parser.parse_args())
    except ValueError as error:
        parser.exit(1, f"{error}\n")
