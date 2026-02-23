# Testing GHL Message Type Enum Values

## Current Error
```
422: type must be a valid enum value,type should not be empty
```

## What We've Tried
- ❌ `type: "SMS"` - Invalid enum value
- ❌ `type: "sms"` - Invalid enum value  
- ❌ Omitted type field - Should not be empty

## Possible Values to Try
Based on GHL API patterns, the type might need to be:
- `"SMS"` (uppercase) - Already tried
- `"sms"` (lowercase) - Already tried
- `"text"` - Alternative name
- `"Text"` - Capitalized
- Provider-specific value matching the provider type

## Next Steps
1. Check GHL API documentation for exact enum values
2. Try provider-specific type value
3. Check if type should match provider configuration exactly

## Note
The provider type is SMS, so the message type should likely match that, but the exact format/enum value is unclear from the error messages.




