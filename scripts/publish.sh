#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/publish.sh <major|minor|patch>
BUMP_TYPE="${1:-}"

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
	echo "Usage: ./scripts/publish.sh <major|minor|patch>"
	exit 1
fi

# Find the latest semver tag, defaulting to v0.0.0
LATEST_TAG=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n 1)

if [ -z "$LATEST_TAG" ]; then
	LATEST_TAG="v0.0.0"
	echo "No existing version tags found. Starting from v0.0.0."
else
	echo "Latest version: $LATEST_TAG"
fi

# Parse major.minor.patch from the tag
VERSION="${LATEST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# Bump the version
case "$BUMP_TYPE" in
	major)
		MAJOR=$((MAJOR + 1))
		MINOR=0
		PATCH=0
		;;
	minor)
		MINOR=$((MINOR + 1))
		PATCH=0
		;;
	patch)
		PATCH=$((PATCH + 1))
		;;
esac

NEW_VERSION="v${MAJOR}.${MINOR}.${PATCH}"
echo "Bumping $BUMP_TYPE: $LATEST_TAG → $NEW_VERSION"

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
ENTRY="## $NEW_VERSION ($DATE)

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
git commit -m "[publish] [$BUMP_TYPE] $NEW_VERSION changelog update"

echo ""
echo "Committed. You can now create your publish PR."
echo "Make sure the PR title includes: [publish] [$BUMP_TYPE]"
