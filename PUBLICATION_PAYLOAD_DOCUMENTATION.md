# Publication API Payload Documentation

## Endpoint
`POST /api/admin/records/publications`

## Authentication
Requires admin authentication. Include Bearer token in Authorization header:
```
Authorization: Bearer <your-token>
```

## Required Fields

### `name` (string, required)
- The name of the publication
- Cannot be empty or whitespace only
- Example: `"Example Publication Name"`

## Optional Fields

### Basic Information
- **`_id`** (string, UUID): Unique identifier. If not provided, will be auto-generated
- **`domain_authority`** (number | null): Domain authority score (0-100)
- **`domain_rating`** (number | null): Domain rating score
- **`estimated_time`** (string | null): Estimated publication time (e.g., "1-3 Days", "1 Week")
- **`url`** (string | null): Publication website URL
- **`slug`** (string | null): URL-friendly identifier

### Pricing
- **`default_price`** (array of numbers | null): Default pricing array (e.g., `[500]` or `[100, 200, 300]`)
- **`custom_price`** (array of numbers | null): Custom pricing array
- **`salePrice`** (number | null): Sale price if on sale
- **`saleExpireDate`** (string | null): Sale expiration date
- **`showOnSale`** (boolean): Whether to show sale badge

### Content Settings
- **`sponsored`** (string | null): "yes", "no", or "discrete"
- **`indexed`** (string | null): "yes" or "no"
- **`do_follow`** (string | null): "yes" or "no"
- **`image`** (string | null): "yes" or "no"
- **`img_explain`** (string | null): Image requirements explanation

### Genres (array of objects | null)
```json
[
  {
    "name": "News",
    "slug": "news",
    "description": null
  }
]
```
- Each genre object has:
  - `name` (string): Genre name
  - `slug` (string): URL-friendly identifier
  - `description` (string | null): Optional description

### Regions (array of objects | null)
```json
[
  {
    "name": "United States",
    "slug": "united-states",
    "description": null
  }
]
```
- Same structure as genres

### Logo (object | null)
```json
{
  "_type": "image",
  "asset": {
    "_ref": "image-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-400x300-png",
    "_type": "reference"
  }
}
```
- Image reference format for Supabase Storage
- Can be `null` if no logo

### Article Preview (object | string | null)
**As Image Reference:**
```json
{
  "_type": "image",
  "asset": {
    "_ref": "image-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-1200x600-png",
    "_type": "reference"
  }
}
```

**As Plain Text:**
```json
"Plain text description of article preview"
```

### Niche Settings (all boolean | null)
- **`health`**: Accepts health content
- **`cbd`**: Accepts CBD content
- **`crypto`**: Accepts crypto content
- **`gambling`**: Accepts gambling content
- **`erotic`**: Accepts erotic content

### Niche Multipliers (string | null)
- **`health_multiplier`**: Price multiplier for health content (e.g., "1.25")
- **`cbd_multiplier`**: Price multiplier for CBD content
- **`crypto_multiplier`**: Price multiplier for crypto content
- **`gambling_multiplier`**: Price multiplier for gambling content
- **`erotic_multiplier`**: Price multiplier for erotic content
- **`erotic_price`**: Fixed price for erotic content (number | null)

### Other Fields
- **`badges`** (array): Array of badge objects (usually empty `[]`)
- **`business`** (object): Business settings object, typically `{"priceChange": 1}`
- **`isPresale`** (boolean | null): Whether publication is in presale
- **`listicles`** (array | null): Listicles information
- **`moreInfo`** (string | null): Additional information (can be JSON string)

## Example Minimal Payload

```json
{
  "name": "My Publication",
  "default_price": [500],
  "genres": [
    {
      "name": "News",
      "slug": "news",
      "description": null
    }
  ],
  "regions": [
    {
      "name": "United States",
      "slug": "united-states",
      "description": null
    }
  ]
}
```

## Example Full Payload

See `publication-payload-example.json` for a complete example with all fields.

## Notes

1. **Field Naming**: All fields use snake_case (e.g., `domain_authority`, not `domainAuthority`)
2. **Null Values**: Most optional fields can be `null` or omitted
3. **Empty Arrays**: Empty arrays should be `null` for genres and regions
4. **UUID Generation**: `_id` will be auto-generated if not provided
5. **Image References**: Logo and article_preview use Supabase Storage image reference format
6. **Validation**: The API validates that `name` is not empty

## Response

### Success (200)
```json
{
  "success": true,
  "record": {
    // Created publication record with applied price adjustments
  }
}
```

### Error (400/401/500)
```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "Error code"
}
```

