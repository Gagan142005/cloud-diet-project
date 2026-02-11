from azure.storage.blob import BlobServiceClient
import pandas as pd
import io
import os
import json
from pathlib import Path

# ✅ Azurite connection (no keys needed)
CONNECT_STR = "UseDevelopmentStorage=true"

# ✅ Force older API version (fixes "API version not supported by Azurite")
API_VERSION = "2021-08-06"

CONTAINER_NAME = "datasets"
BLOB_NAME = "All_Diets.csv"

def run_function():
    # Connect to Azurite
    bsc = BlobServiceClient.from_connection_string(CONNECT_STR, api_version=API_VERSION)

    container = bsc.get_container_client(CONTAINER_NAME)
    blob = container.get_blob_client(BLOB_NAME)

    # Download CSV from Azurite
    content = blob.download_blob().readall()
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip()

    # Convert macro columns to numeric + handle missing
    macro_cols = ["Protein(g)", "Carbs(g)", "Fat(g)"]
    for col in macro_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df[macro_cols] = df[macro_cols].fillna(df[macro_cols].mean())

    # Calculate average macros per diet type
    avg = df.groupby("Diet_type")[macro_cols].mean().reset_index()

    # Save as JSON (simulate NoSQL)
    out_dir = Path(__file__).parent / "simulated_nosql"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "results.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(avg.to_dict(orient="records"), f, indent=2)

    print(f"✅ Processed data from Azurite and saved results to: {out_path}")

if __name__ == "__main__":
    run_function()
