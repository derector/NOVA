"""Inspect and verify NOVA release APKs with the pinned Android build tools."""

from pathlib import Path
import re
import subprocess


PACKAGE_NAME = "io.nova.app"
MAX_APK_BYTES = 256 * 1024 * 1024
SHA256 = re.compile(r"[0-9a-fA-F]{64}")
VERSION_NAME = re.compile(r"[0-9][0-9A-Za-z.+-]{0,63}")


def verify_release_apk(apk: Path, build_tools: Path, signer_sha256: str) -> tuple[int, str]:
    if not SHA256.fullmatch(signer_sha256):
        raise ValueError("NOVA_RELEASE_CERT_SHA256 must be a SHA-256 certificate digest")

    badging = subprocess.check_output([build_tools / "aapt", "dump", "badging", apk], text=True)
    package = re.search(
        r"^package: name='(.*?)' versionCode='([0-9]+)' versionName='(.*?)'", badging, re.MULTILINE
    )
    if not package or package[1] != PACKAGE_NAME or not re.search(r"^sdkVersion:'26'$", badging, re.MULTILINE):
        raise ValueError("Unexpected APK package or minimum SDK")
    version_code = int(package[2])
    version_name = package[3]
    if not 0 < version_code <= 2**31 - 1 or not VERSION_NAME.fullmatch(version_name):
        raise ValueError("Unexpected APK version")

    verification = subprocess.check_output(
        [build_tools / "apksigner", "verify", "--verbose", "--print-certs", apk],
        text=True,
    )
    signers = re.findall(
        r"^Signer #[0-9]+ certificate SHA-256 digest: ([0-9a-fA-F]{64})$", verification, re.MULTILINE
    )
    if [signer.lower() for signer in signers] != [signer_sha256.lower()] or (
        "Verified using v2 scheme (APK Signature Scheme v2): true" not in verification
    ):
        raise ValueError("APK must match the pinned NOVA certificate and have a valid v2 signature")
    return version_code, version_name
