#!/usr/bin/env bash
set -euo pipefail

# Find the last [publish] commit, or use the root if none exists
LAST_PUBLISH=$(git log --oneline --grep='\[publish\]' -1 --format='%H' 2>/dev/null || true)

if [ -z "$LAST_PUBLISH" ]; then
	echo "No previous [publish] commit found. Including all commits."
	COMMITS=$(git log --oneline --no-merges --reverse)
else
	echo "Last publish: $(git log --oneline -1 "$LAST_PUBLISH")"
	COMMITS=$(git log --oneline --no-merges --reverse "${LAST_PUBLISH}..HEAD")
fi

if [ -z "$COMMITS" ]; then
	echo "No new commits since last publish. Nothing to do."
	exit 0
fi

DATE=$(date +%Y-%m-%d)
ENTRY="## $DATE

$( echo "$COMMITS" | while IFS= read -r line; do
	# Strip the short hash, keep the message
	MSG=$(echo "$line" | sed 's/^[a-f0-9]* //')
	echo "- $MSG"
done )
"

CHANGELOG="CHANGELOG.md"

if [ -f "$CHANGELOG" ]; then
	# Prepend new entry after the header
	EXISTING=$(tail -n +3 "$CHANGELOG")
	cat > "$CHANGELOG" <<EOF
# Changelog

$ENTRY
$EXISTING
EOF
else
	cat > "$CHANGELOG" <<EOF
# Changelog

$ENTRY
EOF
fi

echo ""
echo "Updated $CHANGELOG with $(echo "$COMMITS" | wc -l | tr -d ' ') commits."
echo ""

git add "$CHANGELOG"
git commit -m "[publish] $DATE changelog update"

echo ""
echo "Committed. You can now create your publish PR."
