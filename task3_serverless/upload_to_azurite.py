from azure.storage.blob import BlobServiceClient
from pathlib import Path

# ✅ Azurite connection
CONNECT_STR = "UseDevelopmentStorage=true"

# ✅ Force an older API version compatible with Azurite
API_VERSION = "2021-08-06"

CONTAINER = "datasets"
BLOB_NAME = "All_Diets.csv"

# ✅ If your CSV is in the same folder as this script:
FILE_NAME = Path(__file__).parent / "All_Diets.csv"

# If your CSV is in a different folder, use something like:
# FILE_NAME = Path(__file__).parent / "data" / "All_Diets.csv"

# Create blob service client with compatible API version
bsc = BlobServiceClient.from_connection_string(CONNECT_STR, api_version=API_VERSION)
container = bsc.get_container_client(CONTAINER)

# Create container if it doesn't exist
try:
    container.create_container()
except Exception:
    pass

blob = container.get_blob_client(BLOB_NAME)

# Upload file
with open(FILE_NAME, "rb") as f:
    blob.upload_blob(f, overwrite=True)

print("✅ Uploaded All_Diets.csv to Azurite container 'datasets'")
print(f"✅ Local file used: {FILE_NAME}")
