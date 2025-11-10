const fs = require('fs');
const path = require('path');

// Read the data files
const listiclesPath = path.join(__dirname, '..', 'data', 'listiclesData.json');
const publicationsPath = path.join(__dirname, '..', 'data', 'publicationsData.json');

console.log('Reading data files...');
const listiclesData = JSON.parse(fs.readFileSync(listiclesPath, 'utf8'));
const publicationsData = JSON.parse(fs.readFileSync(publicationsPath, 'utf8'));

// Extract publications array from publicationsData
const publications = publicationsData.result || publicationsData;

// Create a map of publication names to genres for faster lookup
const publicationGenresMap = new Map();

publications.forEach(pub => {
  if (pub.name && pub.genres && Array.isArray(pub.genres)) {
    // Store both exact name and some variations
    const names = [
      pub.name,
      pub.name.toLowerCase(),
      pub.name.replace(/\s+/g, ' ').trim(),
      // Handle "Staff" suffix variations
      pub.name.replace(/\s+Staff$/i, ''),
      pub.name + ' Staff'
    ];
    
    const genreNames = pub.genres.map(g => g.name).filter(Boolean);
    
    names.forEach(name => {
      if (!publicationGenresMap.has(name.toLowerCase())) {
        publicationGenresMap.set(name.toLowerCase(), genreNames);
      }
    });
  }
});

console.log(`Found ${publicationGenresMap.size} unique publications in publicationsData`);

// Update listicles data with genres
let updatedCount = 0;
let notFoundList = [];

const updatedListicles = listiclesData.map(listicle => {
  const publicationName = listicle.publication;
  
  if (!publicationName) {
    return listicle;
  }
  
  // Try different variations of the name
  const namesToTry = [
    publicationName,
    publicationName.replace(/\s+Staff$/i, ''),
    publicationName.replace(/\s+Staff$/i, '').trim(),
    // Remove "Staff" if it exists
    publicationName.includes('Staff') ? publicationName.replace(/\s+Staff/gi, '') : publicationName + ' Staff'
  ];
  
  let foundGenres = null;
  let matchedName = null;
  
  for (const nameToTry of namesToTry) {
    const genres = publicationGenresMap.get(nameToTry.toLowerCase());
    if (genres && genres.length > 0) {
      foundGenres = genres;
      matchedName = nameToTry;
      break;
    }
  }
  
  if (foundGenres) {
    // Update the genres field
    const oldGenres = listicle.genres;
    
    // Format genres: if more than 2, show count, otherwise show comma-separated list
    let newGenres;
    if (foundGenres.length > 2) {
      newGenres = `${foundGenres.length} genres`;
    } else {
      newGenres = foundGenres.join(', ');
    }
    
    if (oldGenres !== newGenres) {
      console.log(`✅ Updated "${publicationName}": "${oldGenres}" → "${newGenres}" (matched with "${matchedName}")`);
      updatedCount++;
    }
    
    return {
      ...listicle,
      genres: newGenres
    };
  } else {
    notFoundList.push(publicationName);
    return listicle;
  }
});

// Write the updated data back to the file
fs.writeFileSync(listiclesPath, JSON.stringify(updatedListicles, null, 2));

console.log('\n📊 Summary:');
console.log(`Total listicles: ${listiclesData.length}`);
console.log(`Updated: ${updatedCount}`);
console.log(`Not found: ${notFoundList.length}`);

if (notFoundList.length > 0) {
  console.log('\n⚠️ Publications not found in publicationsData:');
  notFoundList.forEach(name => console.log(`  - ${name}`));
}

console.log('\n✅ Listicles data has been updated successfully!');
