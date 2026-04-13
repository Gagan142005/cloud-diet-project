import azure.functions as func
import pandas as pd
import io
import json
import os
import time
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
import bcrypt

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# -----------------------------
# Cosmos DB setup
# -----------------------------
COSMOS_CONN = os.environ["COSMOS_CONNECTION"]
cosmos_client = CosmosClient.from_connection_string(COSMOS_CONN)
database = cosmos_client.get_database_client("usersdb")
users_container = database.get_container_client("users")


# -----------------------------
# Blob Trigger
# -----------------------------
@app.blob_trigger(arg_name="myblob", path="datasets/{name}", connection="AzureWebJobsStorage")
def blobProcessor(myblob: func.InputStream):
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

        print("Blob processing completed successfully!")

    except Exception as e:
        print(f"Blob trigger error: {str(e)}")


# -----------------------------
# Nutrition API (cache)
# -----------------------------
@app.route(route="nutrition")
def nutrition(req: func.HttpRequest) -> func.HttpResponse:
    start_time = time.time()

    try:
        connect_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        blob_service_client = BlobServiceClient.from_connection_string(connect_str)

        blob_client = blob_service_client.get_blob_client(
            container="datasets",
            blob="processed/summary.json"
        )

        content = blob_client.download_blob().readall()
        data = json.loads(content)

        execution_time = round(time.time() - start_time, 3)

        return func.HttpResponse(
            json.dumps({
                "data": data,
                "execution_time_seconds": execution_time,
                "blob": "processed/summary.json (CACHED)",
                "source": "cache"
            }),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        print("Nutrition API error:", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Something went wrong"}),
            status_code=500,
            mimetype="application/json"
        )


# -----------------------------
# Recipes API
# -----------------------------
@app.route(route="recipes")
def recipes(req: func.HttpRequest) -> func.HttpResponse:
    try:
        connect_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        blob_service_client = BlobServiceClient.from_connection_string(connect_str)

        blob_client = blob_service_client.get_blob_client(
            container="datasets",
            blob="processed/cleaned_diets.csv"
        )

        content = blob_client.download_blob().readall()
        df = pd.read_csv(io.BytesIO(content))
        df.columns = df.columns.str.strip()

        diet = (req.params.get("diet") or "").strip().lower()
        search = (req.params.get("search") or "").strip().lower()
        page = int(req.params.get("page", 1))
        page_size = int(req.params.get("page_size", 2))

        if "Diet_type" in df.columns:
            df["Diet_type"] = df["Diet_type"].fillna("").astype(str)
        if "Recipe_name" in df.columns:
            df["Recipe_name"] = df["Recipe_name"].fillna("").astype(str)
        if "Cuisine_type" in df.columns:
            df["Cuisine_type"] = df["Cuisine_type"].fillna("").astype(str)

        if diet and diet != "all" and "Diet_type" in df.columns:
            df = df[df["Diet_type"].str.lower() == diet]

        if search:
            search_mask = False

            if "Recipe_name" in df.columns:
                recipe_match = df["Recipe_name"].str.lower().str.contains(search, na=False)
                search_mask = recipe_match if isinstance(search_mask, bool) else (search_mask | recipe_match)

            if "Cuisine_type" in df.columns:
                cuisine_match = df["Cuisine_type"].str.lower().str.contains(search, na=False)
                search_mask = cuisine_match if isinstance(search_mask, bool) else (search_mask | cuisine_match)

            if "Diet_type" in df.columns:
                diet_match = df["Diet_type"].str.lower().str.contains(search, na=False)
                search_mask = diet_match if isinstance(search_mask, bool) else (search_mask | diet_match)

            if not isinstance(search_mask, bool):
                df = df[search_mask]

        total_records = len(df)
        total_pages = max(1, (total_records + page_size - 1) // page_size)

        if page < 1:
            page = 1
        if page > total_pages:
            page = total_pages

        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_df = df.iloc[start_index:end_index]

        return func.HttpResponse(
            json.dumps({
                "page": page,
                "page_size": page_size,
                "total_records": total_records,
                "total_pages": total_pages,
                "data": paginated_df.to_dict(orient="records")
            }),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        print("Recipes API error:", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Failed to load recipes data"}),
            mimetype="application/json",
            status_code=500
        )


# -----------------------------
# Register API
# -----------------------------
@app.route(route="register", methods=["POST"])
def register(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        name = body.get("name")
        email = body.get("email")
        password = body.get("password")

        if not name or not email or not password:
            return func.HttpResponse(
                json.dumps({"error": "Missing fields"}),
                mimetype="application/json",
                status_code=400
            )

        query = "SELECT * FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": email}]
        existing_users = list(
            users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            )
        )

        if existing_users:
            return func.HttpResponse(
                json.dumps({"error": "User already exists"}),
                mimetype="application/json",
                status_code=400
            )

        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        user_item = {
            "id": email,
            "name": name,
            "email": email,
            "password": hashed_password,
            "provider": "local"
        }

        users_container.create_item(body=user_item)

        return func.HttpResponse(
            json.dumps({"message": "User registered successfully"}),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        print("Register API error:", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Error registering user"}),
            mimetype="application/json",
            status_code=500
        )


# -----------------------------
# Login API
# -----------------------------
@app.route(route="login", methods=["POST"])
def login(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        email = body.get("email")
        password = body.get("password")

        if not email or not password:
            return func.HttpResponse(
                json.dumps({"error": "Missing email or password"}),
                mimetype="application/json",
                status_code=400
            )

        query = "SELECT * FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": email}]
        users = list(
            users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            )
        )

        if not users:
            return func.HttpResponse(
                json.dumps({"error": "User not found"}),
                mimetype="application/json",
                status_code=404
            )

        user = users[0]

        if bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
            return func.HttpResponse(
                json.dumps({
                    "message": "Login success",
                    "name": user["name"],
                    "email": user["email"]
                }),
                mimetype="application/json",
                status_code=200
            )

        return func.HttpResponse(
            json.dumps({"error": "Invalid password"}),
            mimetype="application/json",
            status_code=401
        )

    except Exception as e:
        print("Login API error:", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Error logging in"}),
            mimetype="application/json",
            status_code=500
        )