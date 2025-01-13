# Function to backup configuration
function Backup-Config {
    Write-Host "Creating backup of Tinode configuration..."
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item "single-instance.yml" "single-instance.yml.backup.$timestamp"
    Write-Host "Backup created successfully!"
}

# Function to restore configuration
function Restore-Config {
    if (Test-Path "single-instance.yml.backup") {
        Write-Host "Stopping containers..."
        docker-compose down
        Write-Host "Restoring configuration..."
        Copy-Item "single-instance.yml.backup" "single-instance.yml" -Force
        Write-Host "Starting containers..."
        docker-compose up -d
        Write-Host "Restore completed!"
    }
    else {
        Write-Host "No backup file found!" -ForegroundColor Red
    }
}

# Main menu
param(
    [Parameter(Position=0)]
    [ValidateSet("backup", "restore")]
    [string]$Action
)

switch ($Action) {
    "backup" { Backup-Config }
    "restore" { Restore-Config }
    default {
        Write-Host "Usage: .\docker-backup.ps1 {backup|restore}"
        Write-Host "  backup  - Create a backup of the current configuration"
        Write-Host "  restore - Restore from the most recent backup"
    }
} 