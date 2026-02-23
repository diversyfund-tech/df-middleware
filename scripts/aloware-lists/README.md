# Aloware Call List CSV Files

These CSV files are used to create empty call lists in Aloware. The middleware will automatically populate these lists with contacts based on GHL tags and assignments.

## Files Created

### Required Lists:
- `DF_RAFI_CALL_NOW.csv`
- `DF_RAFI_NEW_LEADS.csv`
- `DF_RAFI_FOLLOW_UP.csv`
- `DF_RAFI_HOT.csv`
- `DF_CHRIS_CALL_NOW.csv`
- `DF_CHRIS_NEW_LEADS.csv`
- `DF_CHRIS_FOLLOW_UP.csv`
- `DF_CHRIS_HOT.csv`

### Optional Lists:
- `DF_UNASSIGNED_CALL_NOW.csv`
- `DF_UNASSIGNED_NEW_LEADS.csv`

## How to Import

1. Log into Aloware at https://app.aloware.com
2. Navigate to Lists: https://app.aloware.com/lists
3. Click "Create List"
4. Select "Import CSV"
5. Upload each CSV file one at a time
6. **Important**: When importing, make sure the list name matches the CSV filename exactly (e.g., `DF_RAFI_CALL_NOW`)
7. The lists will be created empty (just headers), which is correct - the middleware will add contacts automatically

## CSV Format

Each CSV file contains the following headers:
- `phone_number` (required)
- `first_name`
- `last_name`
- `email`
- `country`
- `state`
- `city`
- `timezone`

The files contain only headers (no data rows) because contacts will be added programmatically by the middleware.

## After Import

Once all lists are created in Aloware, the middleware will:
1. Automatically find these lists by name
2. Add contacts to them based on GHL tags and agent assignments
3. Store the list mappings in the database for future reference

## Testing

After importing all lists, test by:
1. Adding a tag like "Owner: Rafi" and "Call_Now" to a contact in GHL
2. The middleware should automatically add that contact to the `DF_RAFI_CALL_NOW` list in Aloware





