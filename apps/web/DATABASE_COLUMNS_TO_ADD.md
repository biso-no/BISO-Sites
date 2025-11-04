# Database Columns to Add to Events Table

The MCP server encountered permission errors, so you'll need to add these columns manually through your Appwrite Console.

## Navigate to Appwrite Console
1. Go to your Appwrite Console
2. Select your project
3. Navigate to **Databases** → **app** → **events** table
4. Click **Add Column** for each of the following

## Columns to Add

### 1. member_only
- **Type:** Boolean
- **Key:** `member_only`
- **Required:** No
- **Default:** `false`
- **Description:** Marks events that are exclusive to members only

### 2. collection_id
- **Type:** String
- **Key:** `collection_id`
- **Size:** 100
- **Required:** No
- **Description:** References the parent collection event (e.g., "buddy-week-2024", "leadership-week-2024")

### 3. is_collection
- **Type:** Boolean
- **Key:** `is_collection`
- **Required:** No
- **Default:** `false`
- **Description:** Marks events that are collection parent events (like Buddy Week 2024)

### 4. collection_pricing
- **Type:** Enum
- **Key:** `collection_pricing`
- **Elements:** `bundle`, `individual`
- **Required:** No
- **Description:** Pricing model for collection events
  - `bundle`: One price for all events in the collection
  - `individual`: Each event in the collection has separate pricing

## How These Fields Work Together

### Example 1: Bundle Collection (Buddy Week)
```typescript
// Parent collection event
{
  title: "Buddy Week 2024",
  is_collection: true,
  collection_id: "buddy-week-2024",  // References itself
  collection_pricing: "bundle",
  price: 500
}

// Child events
{
  title: "Buddy Week: Campus Tour",
  is_collection: false,
  collection_id: "buddy-week-2024",  // References parent
  price: 0  // Included in bundle
}
```

### Example 2: Individual Pricing Collection (Leadership Week)
```typescript
// Parent collection event
{
  title: "Leadership Week 2024",
  is_collection: true,
  collection_id: "leadership-week-2024",
  collection_pricing: "individual",
  price: null  // Not applicable
}

// Child events
{
  title: "Leadership Week: Strategic Thinking",
  is_collection: false,
  collection_id: "leadership-week-2024",
  price: 150  // Individual pricing
}
```

### Example 3: Members-Only Event
```typescript
{
  title: "Members-Only Lounge Night",
  member_only: true,
  price: 0  // Free for members
}
```

## After Adding Columns

The UI will automatically:
- Show "Collection" badge on parent events
- Hide child events from main listing (they appear only in collection detail view)
- Show "Members Only" badge on exclusive events
- Hide member-only events from non-members
- Display bundle vs individual pricing information
- Filter out non-member users from seeing member-only events

## Testing

After adding the columns, restart your dev server and the events page will automatically support all these features!

