output "raw_dataset" {
  value = local.raw
}

output "mart_dataset" {
  value = local.mart
}

output "loader_service_account" {
  value = google_service_account.loader.email
}

output "reporting_service_account" {
  value = google_service_account.reporting.email
}

output "key_files" {
  value = [for f in local_sensitive_file.keys : abspath(f.filename)]
}
