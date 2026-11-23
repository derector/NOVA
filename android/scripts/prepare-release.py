"""Verify the signed release APK and prepare files for the public update channel."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

from release_apk import MAX_APK_BYTES, PACKAGE_NAME, verify_release_apk


def prepare_release(args: argparse.Namespace) -> None:
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

    version_code, version_name = verify_release_apk(args.apk, args.build_tools, args.signer_sha256)
    if args.tag != f"v{version_name}":
        raise ValueError("The release tag must match the APK versionName")
    if not 0 <= args.minimum_version_code <= version_code:
        raise ValueError("Invalid minimum or current versionCode")

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
        "signerSha256": args.signer_sha256.lower(),
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
