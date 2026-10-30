#!/usr/bin/env bash
# Gate an Android App Bundle before it goes to Play: signed at all, and signed with THE key.
#
# Copied from Daybook's, with one change: Daybook leaves its upload key free to differ, while Drill
# builds its APK and its bundle in one step with one key, so this pins it like verify-apk.sh.
set -euo pipefail

AAB="${1:?usage: verify-aab.sh <path-to-aab>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_FILE="$ROOT/release-key.sha256"
KEYTOOL="${JAVA_HOME:-/usr}/bin/keytool"

fail() { echo "verify-aab: FAIL: $*" >&2; exit 1; }

[[ -f "$AAB" ]] || fail "no such bundle: $AAB"
[[ -x "$KEYTOOL" ]] || fail "keytool not found at $KEYTOOL"
[[ -f "$EXPECTED_FILE" ]] || fail "missing $EXPECTED_FILE: put the SHA-256 of the Drill release certificate in it (see CLAUDE.md, Android)"

# An unsigned bundle has no signature block in META-INF at all.
unzip -l "$AAB" | grep -qE "META-INF/.*\.(RSA|DSA|EC)$" || fail "bundle contains no signature block: it was built without a signing key"

ACTUAL="$("$KEYTOOL" -printcert -jarfile "$AAB" 2>/dev/null | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//' | tr -d ': ' | tr 'A-Z' 'a-z' || true)"
[[ -n "$ACTUAL" ]] || fail "could not read a certificate from the bundle"
EXPECTED="$(tr -d '[:space:]:' < "$EXPECTED_FILE" | tr 'A-Z' 'a-z')"
[[ "$ACTUAL" == "$EXPECTED" ]] || fail "certificate mismatch.
  expected $EXPECTED
  actual   $ACTUAL"

echo "verify-aab: OK"
echo "  file        $(basename "$AAB")"
echo "  certificate $ACTUAL"
