import 'dotenv/config';
import mongoose from 'mongoose';
import Business from '../src/modules/business/business.model.js';

async function migrateCoordinates() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not set in environment variables');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for coordinate migration');

  const businesses = await Business.find({});
  console.log(`Found ${businesses.length} businesses in database`);

  for (const b of businesses) {
    console.log(`Business: "${b.name}" | Location: "${b.location}" | Current coords:`, b.coordinates);

    const name = (b.name || '').toLowerCase();
    const location = (b.location || '').toLowerCase();
    const address = (b.address || '').toLowerCase();

    let updatedCoords = null;
    let city = b.locationDetails?.city;
    let state = b.locationDetails?.state;
    let postalCode = b.locationDetails?.postalCode;

    if (name.includes('jalandhar') || location.includes('jalandhar') || address.includes('jalandhar')) {
      updatedCoords = { lat: 31.3056, lng: 75.5794 };
      city = 'Jalandhar';
      state = 'Punjab';
      postalCode = postalCode || '144003';
    } else if (name.includes('bh-9') || name.includes('lpu') || location.includes('lpu') || address.includes('lpu') || location.includes('phagwara') || address.includes('phagwara')) {
      updatedCoords = { lat: 31.2530, lng: 75.7037 };
      city = 'Phagwara';
      state = 'Punjab';
      postalCode = postalCode || '144402';
    } else if (name.includes('studio') || location.includes('gorakhpur') || address.includes('gorakhpur')) {
      updatedCoords = { lat: 26.7606, lng: 83.3732 };
      city = 'Gorakhpur';
      state = 'Uttar Pradesh';
      postalCode = postalCode || '273001';
    }

    if (updatedCoords) {
      b.coordinates = updatedCoords;
      b.locationDetails = {
        country: 'India',
        city: city || 'Jalandhar',
        state: state || 'Punjab',
        postalCode: postalCode || '',
      };
      await b.save();
      console.log(`Updated "${b.name}" -> Coordinates: [${updatedCoords.lat}, ${updatedCoords.lng}], City: ${b.locationDetails.city}, State: ${b.locationDetails.state}`);
    }
  }

  console.log('Coordinate migration complete');
  await mongoose.disconnect();
}

migrateCoordinates().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

