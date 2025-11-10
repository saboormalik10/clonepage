const fs = require('fs');
const path = require('path');

// Read the data files
const bestSellersPath = path.join(__dirname, '..', 'data', 'bestSellersData.json');
const publicationsPath = path.join(__dirname, '..', 'data', 'publicationsData.json');

console.log('Reading data files...');
const bestSellersData = JSON.parse(fs.readFileSync(bestSellersPath, 'utf8'));
const publicationsData = JSON.parse(fs.readFileSync(publicationsPath, 'utf8'));

// Extract publications array from publicationsData
const publications = publicationsData.result || publicationsData;

// Create a map of publication names to niches with prices
const publicationNichesMap = new Map();

publications.forEach(pub => {
  if (pub.name) {
    const nichesWithPrices = [];
    
    // Get the base price
    const basePrice = pub.defaultPrice && pub.defaultPrice[0] ? pub.defaultPrice[0] : 0;
    
    // Check each niche and calculate price
    if (pub.health === true) {
      const multiplier = pub.healthMultiplier ? parseFloat(pub.healthMultiplier) : 1;
      const price = pub.healthPrice || Math.round(basePrice * multiplier);
      nichesWithPrices.push(`Health: $${price.toLocaleString()}`);
    }
    
    if (pub.cbd === true) {
      const multiplier = pub.cbdMultiplier ? parseFloat(pub.cbdMultiplier) : 1;
      const price = pub.cbdPrice || Math.round(basePrice * multiplier);
      nichesWithPrices.push(`CBD: $${price.toLocaleString()}`);
    }
    
    if (pub.crypto === true) {
      const multiplier = pub.cryptoMultiplier ? parseFloat(pub.cryptoMultiplier) : 1;
      const price = pub.cryptoPrice || Math.round(basePrice * multiplier);
      nichesWithPrices.push(`Crypto: $${price.toLocaleString()}`);
    }
    
    if (pub.gambling === true) {
      const multiplier = pub.gamblingMultiplier ? parseFloat(pub.gamblingMultiplier) : 1;
      const price = pub.gamblingPrice || Math.round(basePrice * multiplier);
      nichesWithPrices.push(`Gambling: $${price.toLocaleString()}`);
    }
    
    if (pub.erotic === true) {
      const multiplier = pub.eroticMultiplier ? parseFloat(pub.eroticMultiplier) : 1;
      const price = pub.eroticPrice || Math.round(basePrice * multiplier);
      nichesWithPrices.push(`Erotic: $${price.toLocaleString()}`);
    }
    
    // Store with lowercase key for case-insensitive matching
    publicationNichesMap.set(pub.name.toLowerCase().trim(), nichesWithPrices);
  }
});

console.log(`Found ${publicationNichesMap.size} unique publications in publicationsData`);

// Update best sellers data with niches and prices
let updatedCount = 0;
let notFoundList = [];

const updatedBestSellers = bestSellersData.map(bestSeller => {
  const publicationName = bestSeller.publication;
  
  if (!publicationName) {
    return bestSeller;
  }
  
  // Try to find exact match first (case-insensitive)
  let foundNiches = publicationNichesMap.get(publicationName.toLowerCase().trim());
  
  // If not found, try removing "Staff" suffix
  if (!foundNiches && publicationName.includes('Staff')) {
    const nameWithoutStaff = publicationName.replace(/\s+Staff$/i, '').trim();
    foundNiches = publicationNichesMap.get(nameWithoutStaff.toLowerCase());
  }
  
  // If still not found, try adding "Staff" suffix
  if (!foundNiches && !publicationName.includes('Staff')) {
    const nameWithStaff = publicationName + ' Staff';
    foundNiches = publicationNichesMap.get(nameWithStaff.toLowerCase());
  }
  
  if (foundNiches !== undefined) {
    // Update the niches field with comma-separated niches and prices
    const oldNiches = bestSeller.niches || '';
    const newNiches = foundNiches.length > 0 ? foundNiches.join(', ') : '';
    
    if (oldNiches !== newNiches) {
      console.log(`✅ Updated "${publicationName}": "${oldNiches}" → "${newNiches}"`);
      updatedCount++;
    }
    
    return {
      ...bestSeller,
      niches: newNiches
    };
  } else {
    // Try partial matching for publications with truncated names
    let matchedPub = null;
    let matchedNiches = null;
    
    // Look for publications that start with the best seller publication name
    for (const [pubName, niches] of publicationNichesMap.entries()) {
      if (pubName.startsWith(publicationName.toLowerCase().trim()) || 
          publicationName.toLowerCase().trim().startsWith(pubName)) {
        matchedPub = pubName;
        matchedNiches = niches;
        break;
      }
    }
    
    if (matchedNiches !== null) {
      const oldNiches = bestSeller.niches || '';
      const newNiches = matchedNiches.length > 0 ? matchedNiches.join(', ') : '';
      
      if (oldNiches !== newNiches) {
        if (newNiches) {
          console.log(`✅ Updated "${publicationName}": "${oldNiches}" → "${newNiches}" (partial match)`);
        } else {
          console.log(`ℹ️ "${publicationName}": No niches (partial match)`);
        }
        updatedCount++;
      }
      
      return {
        ...bestSeller,
        niches: newNiches
      };
    } else {
      notFoundList.push(publicationName);
      return bestSeller;
    }
  }
});

// Write the updated data back to the file
fs.writeFileSync(bestSellersPath, JSON.stringify(updatedBestSellers, null, 2));

// Count how many have niches
const withNiches = updatedBestSellers.filter(bs => bs.niches && bs.niches.length > 0).length;

console.log('\n📊 Summary:');
console.log(`Total best sellers: ${bestSellersData.length}`);
console.log(`Updated: ${updatedCount}`);
console.log(`With niches: ${withNiches}`);
console.log(`Not found: ${notFoundList.length}`);

if (notFoundList.length > 0) {
  console.log('\n⚠️ Publications not found in publicationsData:');
  const uniqueNotFound = [...new Set(notFoundList)];
  uniqueNotFound.forEach(name => console.log(`  - ${name}`));
}

console.log('\n✅ Best Sellers niches data has been updated with prices!');

