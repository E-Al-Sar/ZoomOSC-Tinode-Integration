# Build and start the custom Tinode setup
Write-Host "Building and starting custom Tinode setup..." -ForegroundColor Green

# Ensure we're in the right directory
Set-Location $PSScriptRoot

# Stop any existing containers
Write-Host "Stopping any existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.custom.yml down

# Build the custom image
Write-Host "Building custom image..." -ForegroundColor Yellow
docker-compose -f docker-compose.custom.yml build

# Start the services
Write-Host "Starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.custom.yml up -d

# Check the status
Write-Host "Checking service status..." -ForegroundColor Yellow
docker-compose -f docker-compose.custom.yml ps

Write-Host "`nSetup complete! Your Tinode instance should be available at:" -ForegroundColor Green
Write-Host "http://localhost:6060" -ForegroundColor Cyan 