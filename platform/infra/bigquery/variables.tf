variable "project_id" {
  description = "GCP project that holds the warehouse, e.g. fourth-archive-513409-k9."
  type        = string
}

variable "location" {
  description = "BigQuery location for both datasets."
  type        = string
  default     = "asia-southeast1"
}

variable "sandbox" {
  description = "The project has no billing account (BigQuery sandbox): every table expires after 60 days."
  type        = bool
  default     = true
}

variable "write_key_files" {
  description = "Create service-account keys and write them to key_dir. The private keys are also kept in the Terraform state."
  type        = bool
  default     = true
}

variable "key_dir" {
  description = "Where the key files go; platform/secrets is git-ignored."
  type        = string
  default     = "../../secrets"
}
