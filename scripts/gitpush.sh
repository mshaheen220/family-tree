#!/bin/bash

# Default version bump is patch (incremental)
VERSION_BUMP="patch"
COMMIT_MSG=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --major) VERSION_BUMP="major"; shift ;;
        --minor) VERSION_BUMP="minor"; shift ;;
        --patch) VERSION_BUMP="patch"; shift ;;
        -m|--message) COMMIT_MSG="$2"; shift 2 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

# 1. Bump version in package.json (without committing/tagging automatically)
npm version $VERSION_BUMP --no-git-tag-version

# Get the newly generated version
NEW_VERSION=$(node -p "require('./package.json').version")

# Construct the commit message
if [ -z "$COMMIT_MSG" ]; then
    FULL_MSG="v$NEW_VERSION"
else
    FULL_MSG="v$NEW_VERSION - $COMMIT_MSG"
fi

# 2. Stage all changes
git add .

# 3. Commit with the new version and message
git commit -m "$FULL_MSG"

# 4. Create a tag for the release and push to GitHub
git tag "v$NEW_VERSION"
git push
git push --tags

echo "✅ Successfully bumped version to v$NEW_VERSION, committed, and pushed!"