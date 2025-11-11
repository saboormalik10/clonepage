# Hotshot Social Pricing Portal - Next.js TypeScript Conversion

This project is a Next.js TypeScript conversion of the original HTML/CSS pricing portal.

## Project Structure

```
clonepage/
├── app/
│   ├── globals.css          # Global styles with Tailwind
│   ├── layout.tsx           # Root layout with font configuration
│   └── page.tsx             # Main page component
├── components/
│   ├── Header.tsx           # Header component with logo and logout
│   ├── PricingTabs.tsx     # Tab navigation component
│   └── BroadcastTelevisionTab.tsx  # Broadcast TV table component
├── data/
│   └── tableData.json      # Extracted table data (64 TV listings)
├── public/
│   └── logo.svg            # Logo file (needs to be added)
└── ...config files
```

## Features

- ✅ Next.js 14 with App Router
- ✅ TypeScript
- ✅ Tailwind CSS (configured to match original styles)
- ✅ Headless UI for tab functionality
- ✅ Responsive design matching original
- ✅ Search functionality for TV listings
- ✅ All 64 TV listings extracted and converted

## Prerequisites

- **Node.js 20 or later** (required for @supabase/supabase-js)
- npm or yarn

To check your Node.js version:
```bash
node --version
```

If you need to upgrade Node.js:
- Using nvm: `nvm install 20 && nvm use 20`
- Download from [nodejs.org](https://nodejs.org/)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Add the logo.svg file to the `public/` directory

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Conversion Notes

- All HTML has been converted to React/JSX components
- All CSS classes have been preserved (using Tailwind CSS)
- Table data has been extracted from HTML and stored in JSON
- Tab functionality uses Headless UI (matching original implementation)
- All links and external URLs have been preserved
- SVG icons have been converted to React components

## Tabs

The application includes 8 tabs:
1. PUBLICATIONS (placeholder)
2. BROADCAST TELEVISION (fully implemented with table)
3. DIGITAL TELEVISION (placeholder)
4. LISTICLES (placeholder)
5. BEST SELLERS (placeholder)
6. PR BUNDLES (placeholder)
7. PRINT (placeholder)
8. SOCIAL POST (placeholder)

## Data

The table data for Broadcast Television has been extracted and includes:
- 64 TV listings
- Affiliate names
- Calls, State, Market, Program Name
- Location/Segment types
- Rates
- Example URLs
- Intake form URLs

## Build

```bash
npm run build
npm start
```

