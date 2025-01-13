#!/bin/bash

# Function to backup configuration
backup_config() {
    echo "Creating backup of Tinode configuration..."
    cp single-instance.yml "single-instance.yml.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backup created successfully!"
}

# Function to restore configuration
restore_config() {
    if [ -f single-instance.yml.backup ]; then
        echo "Stopping containers..."
        docker-compose down
        echo "Restoring configuration..."
        cp single-instance.yml.backup single-instance.yml
        echo "Starting containers..."
        docker-compose up -d
        echo "Restore completed!"
    else
        echo "No backup file found!"
    fi
}

# Main menu
case "$1" in
    "backup")
        backup_config
        ;;
    "restore")
        restore_config
        ;;
    *)
        echo "Usage: $0 {backup|restore}"
        echo "  backup  - Create a backup of the current configuration"
        echo "  restore - Restore from the most recent backup"
        exit 1
        ;;
esac 