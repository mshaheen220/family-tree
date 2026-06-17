#!/bin/bash
# Exit immediately if any command fails
set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: ./run_pipeline.sh <path/to/original.ged> <ROOT_ID>"
    echo "Example: ./run_pipeline.sh data/tree.ged I412076094635"
    exit 1
fi

GEDCOM_FILE="$1"
ROOT_ID="$2"

# Calculate the source dir, then define the new target directory structure
SOURCE_DIR=$(dirname "$GEDCOM_FILE")
FILTERED_SOURCE="$SOURCE_DIR/family_tree_filtered_${ROOT_ID}.ged"

TARGET_DIR="data/$ROOT_ID"
FILTERED_GED="$TARGET_DIR/family_tree_filtered.ged"
PROFILES_DIR="$TARGET_DIR/profiles"
RAW_MEDIA_DIR="$TARGET_DIR/raw_media"
DOCS_DIR="$TARGET_DIR/docs"
DB_PATH="$TARGET_DIR/genealogy.db"
VECTOR_DIR="$TARGET_DIR/vector_store"

echo "==========================================="
echo "🧬 Genealogy Agent - Full Pipeline Run"
echo "==========================================="

echo -e "\n[1/4] Filtering Tree..."
cd python-pipeline
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating it now..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
python filter_tree.py --input "../$GEDCOM_FILE" --root-id "$ROOT_ID"

# Move the generated filtered tree into its dedicated ID directory
mkdir -p "../$TARGET_DIR"
if [ -f "../$FILTERED_SOURCE" ]; then
    mv "../$FILTERED_SOURCE" "../$FILTERED_GED"
fi

echo "-> Generating friendly name identifier file..."
python -c '
import sys, json, re
root_id = sys.argv[1].replace("@", "")
gedcom_file = sys.argv[2]
out_dir = sys.argv[3]

name = "Unknown"
birt = "Unknown"

try:
    with open(gedcom_file, "r", encoding="utf-8") as f:
        in_root = False
        in_birt = False
        for line in f:
            if line.startswith(f"0 @{root_id}@ INDI"):
                in_root = True
                continue
            if in_root and line.startswith("0 "):
                break
            if in_root:
                if line.startswith("1 NAME") and name == "Unknown":
                    name = line[7:].replace("/", "").strip()
                elif line.startswith("1 BIRT"):
                    in_birt = True
                elif in_birt and line.startswith("2 DATE"):
                    birt = line[7:].strip()
                    in_birt = False
                elif line.startswith("1 "):
                    in_birt = False
except Exception as e:
    print(f"Warning: Could not parse GEDCOM for friendly name: {e}")

safe_name = re.sub(r"\s+", "_", name.strip())
safe_name = re.sub(r"[^A-Za-z0-9_]", "", safe_name)
out_file = f"{out_dir}/_{safe_name}.json"

data = { "id": root_id, "name": name, "birthdate": birt }
try:
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"   Created info file: {out_file}")
except Exception as e:
    print(f"Warning: Could not write friendly name file: {e}")
' "$ROOT_ID" "../$FILTERED_GED" "../$TARGET_DIR"

echo -e "\n[2/5] Generating Profiles..."
python generate_profiles.py "../$FILTERED_GED"

echo -e "\n[3/5] Building SQLite Database..."
python build_sqlite.py "../$FILTERED_GED"

echo -e "\n[4/5] (Optional) Processing Media..."
if [ -d "../$RAW_MEDIA_DIR" ]; then
    echo "Found $RAW_MEDIA_DIR directory, running OCR..."
    python process_media.py --root-id "$ROOT_ID"
fi
deactivate
cd ..

echo -e "\n[5/5] Building Vector Database..."
cd server-node
if [ ! -d "node_modules" ]; then
    echo "Node modules not found in server-node. Installing them now..."
    npm install --legacy-peer-deps
fi
node build_index.js --root-id "$ROOT_ID"
cd ..

echo -e "\n✅ Pipeline finished successfully! You can now start the server."