terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "8.8.1"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.9.1"
    }
  }
}

provider "google" {
  project               = var.project_id
  region                = var.location
  billing_project       = var.project_id
  user_project_override = true
}
