# BigQuery warehouse

```sh
brew install --cask gcloud-cli
gcloud auth application-default login   # with the Google account that owns the project
gcloud services enable cloudresourcemanager.googleapis.com --project <project_id>   # once per project
cp terraform.tfvars.example terraform.tfvars   # set project_id
terraform init
terraform apply
```

Then load it and open the reports:

```sh
cd ../../services/batch-loader && uv lock --exclude-newer "<7 days ago, RFC 3339>"
cd ../.. && docker compose --profile warehouse up -d --build
```

Metabase: http://localhost:3001 → Add database → BigQuery → upload `secrets/gcp-sa-reporting.json`, dataset `fraud_mart`.
