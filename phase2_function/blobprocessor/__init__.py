import azure.functions as func
import pandas as pd
import io
import json
import os
from azure.storage.blob import BlobServiceClient

def main(myblob: func.InputStream):
    print(f"Blob trigger activated for: {myblob.name}")

    try:
        connect_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        blob_service_client = BlobServiceClient.from_connection_string(connect_str)

        content = myblob.read()
        df = pd.read_csv(io.BytesIO(content))
        df.columns = df.columns.str.strip()

        macro_cols = ["Protein(g)", "Carbs(g)", "Fat(g)"]
        for col in macro_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df[macro_cols] = df[macro_cols].fillna(df[macro_cols].mean())

        cleaned_csv = df.to_csv(index=False)

        cleaned_blob = blob_service_client.get_blob_client(
            container="datasets",
            blob="processed/cleaned_diets.csv"
        )
        cleaned_blob.upload_blob(cleaned_csv, overwrite=True)

        avg = df.groupby("Diet_type")[macro_cols].mean().reset_index()
        summary_data = avg.to_dict(orient="records")

        summary_blob = blob_service_client.get_blob_client(
            container="datasets",
            blob="processed/summary.json"
        )
        summary_blob.upload_blob(json.dumps(summary_data), overwrite=True)

        print("Processing completed successfully!")

    except Exception as e:
        print(f"Error: {str(e)}")