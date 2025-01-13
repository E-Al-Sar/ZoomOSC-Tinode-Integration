# Tinode Docker Configuration Guide

## Working Configuration
The current configuration in `single-instance.yml` is confirmed working as of January 2024. DO NOT modify this file without testing in a separate environment first.

### Key Components
- MySQL database (v5.7)
- Tinode server (latest)
- Tinode exporter for monitoring

### Important Settings
1. Database:
   - MySQL running on port 3306
   - Empty password configuration (for development)
   - Health check enabled

2. Tinode Server:
   - Running on port 6060
   - Using MySQL adapter
   - Push notifications disabled
   - WebRTC disabled
   - Database reset enabled on startup

3. Monitoring:
   - Exporter running on port 6222
   - Configured for InfluxDB metrics

## Backup Instructions
1. Before making any changes:
   ```bash
   cp single-instance.yml single-instance.yml.backup
   ```
2. Test any modifications in a separate directory first
3. Keep track of all changes in version control

## Restore Instructions
If something breaks:
1. Stop all containers:
   ```bash
   docker-compose down
   ```
2. Restore the backup:
   ```bash
   cp single-instance.yml.backup single-instance.yml
   ```
3. Restart the stack:
   ```bash
   docker-compose up -d
   ```

## Safety Checklist Before Changes
- [ ] Create a backup of the current configuration
- [ ] Document the intended changes
- [ ] Test changes in a separate environment
- [ ] Verify all services start correctly
- [ ] Test basic functionality
- [ ] Keep backup file until new changes are verified

## Current Port Mappings
- MySQL: 3306
- Tinode Server: 6060
- Exporter: 6222

DO NOT change these port mappings without updating all related configurations. 