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

// Create a map of publication names to genres for faster lookup
const publicationGenresMap = new Map();

publications.forEach(pub => {
  if (pub.name && pub.genres && Array.isArray(pub.genres)) {
    // Get genre names from the genres array
    const genreNames = pub.genres
      .map(g => g.name)
      .filter(Boolean);
    
    // Store with lowercase key for case-insensitive matching
    publicationGenresMap.set(pub.name.toLowerCase().trim(), genreNames);
  }
});

console.log(`Found ${publicationGenresMap.size} unique publications in publicationsData`);

// Update best sellers data with genres
let updatedCount = 0;
let notFoundList = [];

const updatedBestSellers = bestSellersData.map(bestSeller => {
  const publicationName = bestSeller.publication;
  
  if (!publicationName) {
    return bestSeller;
  }
  
  // Try to find exact match first (case-insensitive)
  let foundGenres = publicationGenresMap.get(publicationName.toLowerCase().trim());
  
  // If not found, try removing "Staff" suffix
  if (!foundGenres && publicationName.includes('Staff')) {
    const nameWithoutStaff = publicationName.replace(/\s+Staff$/i, '').trim();
    foundGenres = publicationGenresMap.get(nameWithoutStaff.toLowerCase());
  }
  
  // If still not found, try adding "Staff" suffix
  if (!foundGenres && !publicationName.includes('Staff')) {
    const nameWithStaff = publicationName + ' Staff';
    foundGenres = publicationGenresMap.get(nameWithStaff.toLowerCase());
  }
  
  if (foundGenres && foundGenres.length > 0) {
    // Update the genres field with comma-separated genre names
    const oldGenres = bestSeller.genres;
    const newGenres = foundGenres.join(', ');
    
    if (oldGenres !== newGenres) {
      console.log(`✅ Updated "${publicationName}": "${oldGenres}" → "${newGenres}"`);
      updatedCount++;
    }
    
    return {
      ...bestSeller,
      genres: newGenres
    };
  } else {
    // Try partial matching for publications with truncated names
    let matchedPub = null;
    let matchedGenres = null;
    
    // Look for publications that start with the best seller publication name
    for (const [pubName, genres] of publicationGenresMap.entries()) {
      if (pubName.startsWith(publicationName.toLowerCase().trim()) || 
          publicationName.toLowerCase().trim().startsWith(pubName)) {
        matchedPub = pubName;
        matchedGenres = genres;
        break;
      }
    }
    
    if (matchedGenres && matchedGenres.length > 0) {
      const oldGenres = bestSeller.genres;
      const newGenres = matchedGenres.join(', ');
      
      if (oldGenres !== newGenres) {
        console.log(`✅ Updated "${publicationName}": "${oldGenres}" → "${newGenres}" (partial match)`);
        updatedCount++;
      }
      
      return {
        ...bestSeller,
        genres: newGenres
      };
    } else {
      notFoundList.push(publicationName);
      return bestSeller;
    }
  }
});

// Write the updated data back to the file
fs.writeFileSync(bestSellersPath, JSON.stringify(updatedBestSellers, null, 2));

console.log('\n📊 Summary:');
console.log(`Total best sellers: ${bestSellersData.length}`);
console.log(`Updated: ${updatedCount}`);
console.log(`Not found: ${notFoundList.length}`);

if (notFoundList.length > 0) {
  console.log('\n⚠️ Publications not found in publicationsData:');
  const uniqueNotFound = [...new Set(notFoundList)];
  uniqueNotFound.forEach(name => console.log(`  - ${name}`));
}

console.log('\n✅ Best Sellers data has been updated successfully!');

