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

// Create a map of publication names to niches for faster lookup
const publicationNichesMap = new Map();

publications.forEach(pub => {
  if (pub.name) {
    // Collect niches based on boolean fields
    const niches = [];
    
    // Check each niche field
    if (pub.health === true) niches.push('Health');
    if (pub.cbd === true) niches.push('CBD');
    if (pub.crypto === true) niches.push('Crypto');
    if (pub.gambling === true) niches.push('Gambling');
    if (pub.erotic === true) niches.push('Erotic');
    
    // Store with lowercase key for case-insensitive matching
    publicationNichesMap.set(pub.name.toLowerCase().trim(), niches);
  }
});

console.log(`Found ${publicationNichesMap.size} unique publications in publicationsData`);

// Update best sellers data with niches
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
    // Update the niches field with comma-separated niche names
    const oldNiches = bestSeller.niches || '';
    const newNiches = foundNiches.length > 0 ? foundNiches.join(', ') : '';
    
    if (oldNiches !== newNiches) {
      if (newNiches) {
        console.log(`✅ Updated "${publicationName}": "${oldNiches}" → "${newNiches}"`);
      } else {
        console.log(`ℹ️ "${publicationName}": No niches accepted`);
      }
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
          console.log(`ℹ️ "${publicationName}": No niches accepted (partial match)`);
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

console.log('\n✅ Best Sellers niches data has been updated successfully!');

