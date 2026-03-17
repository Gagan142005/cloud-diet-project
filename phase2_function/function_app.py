import azure.functions as func
import pandas as pd
import io
import json
import os
import time
from azure.storage.blob import BlobServiceClient

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="nutrition")
def nutrition(req: func.HttpRequest) -> func.HttpResponse:
    start_time = time.time()

    try:
        connect_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        container_name = "datasets"
        blob_name = "All_Diets.csv"

        blob_service_client = BlobServiceClient.from_connection_string(connect_str)
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_name
        )

        content = blob_client.download_blob().readall()
        df = pd.read_csv(io.BytesIO(content))
        df.columns = df.columns.str.strip()

        macro_cols = ["Protein(g)", "Carbs(g)", "Fat(g)"]
        for col in macro_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df[macro_cols] = df[macro_cols].fillna(df[macro_cols].mean())

        avg = df.groupby("Diet_type")[macro_cols].mean().reset_index()

        execution_time = round(time.time() - start_time, 3)

        result = {
            "execution_time_seconds": execution_time,
            "container": container_name,
            "blob": blob_name,
            "data": avg.to_dict(orient="records")
        }

        return func.HttpResponse(
            json.dumps(result, indent=2),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )