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
cd ../.. && docker compose up -d --build
```

Metabase: http://localhost:3001, set up as in `../metabase/README.md`.

## Layout

```
datasets/fraud_raw/<table>.json  each landing table's columns (main.tf adds the loader's _ columns)
datasets/fraud_mart/*.sql        each view's query, named for what it does; main.tf says which view runs which
main.tf                          datasets, tables, views, access and service accounts
```

In the SQL, `${raw.<table>}` and `${mart.<view>}` are full project.dataset.table names.
