# Best Seller API Payload Documentation

## Endpoint
`POST /api/admin/records/best-sellers`

## Authentication
Requires admin authentication. Include Bearer token in Authorization header:
```
Authorization: Bearer <your-token>
```

## Required Fields

### `publication` (string, required)
- The name of the best seller publication
- Cannot be empty or whitespace only
- Example: `"Example Best Seller Publication"`

## Optional Fields

### Basic Information
- **`image`** (string | null): Image URL or JSON stringified image object
  - Can be a URL string: `"https://example.com/image.jpg"`
  - Or a JSON stringified object: `"{\"_type\":\"image\",\"asset\":{\"_ref\":\"image-xxx\",\"_type\":\"reference\"}}"`
  - Or `null` if no image

- **`genres`** (string | null): Comma-separated list of genres
  - Example: `"News, Business, Tech, Lifestyle"`
  - Convert from array format: `["News", "Business"]` → `"News, Business"`

- **`price`** (string | null): Formatted price string
  - Format: `"$500"` for single price or `"$500, $750, $1000"` for multiple prices
  - Convert from number array: `[500]` → `"$500"` or `[500, 750]` → `"$500, $750"`

- **`da`** (string | null): Domain authority score as string
  - Example: `"75"` (not number, must be string)
  - Convert from number: `75` → `"75"`

- **`dr`** (string | null): Domain rating score as string
  - Example: `"68"` (not number, must be string)
  - Convert from number: `68` → `"68"`

- **`tat`** (string | null): Turnaround time
  - Example: `"1-3 Days"`, `"1 Week"`, `"3-5 Days"`

- **`region`** (string | null): Comma-separated list of regions
  - Example: `"United States, Canada"`
  - Convert from array format: `["United States", "Canada"]` → `"United States, Canada"`

### Content Settings
- **`sponsored`** (string | null): Sponsored content option
  - Values: `"Yes"`, `"No"`, or `null`

- **`indexed`** (string | null): Indexing status
  - Values: `"Yes"`, `"No"`, `"Maybe"`, or `null`

- **`dofollow`** (string | null): Do-follow link option
  - Values: `"Yes"`, `"No"`, or `null`

- **`example_url`** (string | null): URL to example article
  - Example: `"https://example.com/article-example"`

- **`has_image`** (string | null): Image availability indicator
  - Usually empty string `""` or `null`

### Niches (string | null)
- Formatted as comma-separated list with prices
- Format: `"Health: $500, CBD: $500, Crypto: $500, Gambling: $1,000, Erotic: $500"`
- Each niche is formatted as: `"NicheName: $Price"`
- Prices are formatted with commas for thousands (e.g., `$1,000`)
- Only include niches that are enabled (boolean true)
- Base price typically comes from the first value in `defaultPrice` array

**Niche Formatting Rules:**
- If `health: true` → Add `"Health: $X"` (where X is base price)
- If `cbd: true` → Add `"CBD: $X"`
- If `crypto: true` → Add `"Crypto: $X"`
- If `gambling: true` → Add `"Gambling: $X"`
- If `erotic: true` → Add `"Erotic: $X"`
- Join all enabled niches with `", "` (comma and space)

## Field Naming Convention
All fields use **snake_case** (e.g., `example_url`, `has_image`, not `exampleUrl`, `hasImage`)

## Example Minimal Payload

```json
{
  "publication": "My Best Seller Publication",
  "price": "$500",
  "genres": "News",
  "region": "United States"
}
```

## Example Full Payload

```json
{
  "publication": "Example Best Seller Publication",
  "image": "https://example.com/image.jpg",
  "genres": "News, Business, Tech, Lifestyle",
  "price": "$500",
  "da": "75",
  "dr": "68",
  "tat": "1-3 Days",
  "region": "United States, Canada",
  "sponsored": "No",
  "indexed": "Yes",
  "dofollow": "Yes",
  "example_url": "https://example.com/article-example",
  "has_image": "",
  "niches": "Health: $500, CBD: $500, Crypto: $500, Gambling: $1,000, Erotic: $500"
}
```

## Data Transformation Examples

### From Form Data to API Payload

**Genres (Array → String):**
```javascript
// Input: [{name: "News"}, {name: "Business"}]
// Output: "News, Business"
genres = formData.genres.map(g => g.name).join(', ')
```

**Regions (Array → String):**
```javascript
// Input: [{name: "United States"}, {name: "Canada"}]
// Output: "United States, Canada"
region = formData.regions.map(r => r.name).join(', ')
```

**Price (Number Array → Formatted String):**
```javascript
// Input: [500] or [500, 750]
// Output: "$500" or "$500, $750"
price = formData.defaultPrice.map(p => `$${p}`).join(', ')
```

**DA/DR (Number → String):**
```javascript
// Input: 75
// Output: "75"
da = String(formData.domain_authority)
dr = String(formData.domain_rating)
```

**Niches (Booleans + Base Price → Formatted String):**
```javascript
// Input: health: true, cbd: true, basePrice: 500
// Output: "Health: $500, CBD: $500"
const niches = []
if (formData.health) niches.push(`Health: $${basePrice.toLocaleString()}`)
if (formData.cbd) niches.push(`CBD: $${basePrice.toLocaleString()}`)
if (formData.crypto) niches.push(`Crypto: $${basePrice.toLocaleString()}`)
if (formData.gambling) niches.push(`Gambling: $${basePrice.toLocaleString()}`)
if (formData.erotic) niches.push(`Erotic: $${basePrice.toLocaleString()}`)
niches = niches.length > 0 ? niches.join(', ') : null
```

**Image (Object → JSON String):**
```javascript
// If image is an object:
if (typeof image === 'object') {
  image = JSON.stringify(image)
}
// Result: "{\"_type\":\"image\",\"asset\":{\"_ref\":\"image-xxx\",\"_type\":\"reference\"}}"
```

## Notes

1. **String Formatting**: Most fields are strings, not numbers or booleans
   - `da` and `dr` are strings: `"75"` not `75`
   - `sponsored`, `indexed`, `dofollow` are strings: `"Yes"`/`"No"` not `true`/`false`

2. **Comma-Separated Values**: Genres, regions, and niches use comma-separated strings, not arrays

3. **Price Format**: Always include `$` prefix and format with commas for thousands

4. **Null Values**: Empty strings should be converted to `null` for optional fields

5. **Image Format**: Can be URL string or JSON stringified object

6. **Niches**: Only include niches that are enabled (boolean true), format with base price

## Response

### Success (200)
```json
{
  "success": true,
  "record": {
    // Created best seller record with applied price adjustments
    "id": "uuid-here",
    "publication": "Example Best Seller Publication",
    "price": "$525",  // Adjusted price if price adjustments exist
    // ... other fields
  }
}
```

### Error (400/401/500)
```json
{
  "error": "Error message"
}
```

