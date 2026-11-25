import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
let useMongo = Boolean(process.env.MONGODB_URI);
const staffPin = process.env.STAFF_PIN || '2008';

function requireStaff(req, res, next) {
  if (!staffPin) return res.status(503).json({ error: 'Staff changes are disabled. Set STAFF_PIN on the server.' });
  if (req.get('x-staff-pin') !== staffPin) return res.status(401).json({ error: 'Staff verification failed.' });
  next();
}

const SpaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  building: { type: String, required: true },
  floor: { type: String, default: '1st floor' },
  zone: { type: String, enum: ['Quiet', 'Collaborative', 'Mixed'], required: true },
  capacity: { type: Number, required: true },
  occupiedSeats: { type: Number, default: 0 },
  status: { type: String, enum: ['Available', 'Filling up', 'Busy'], default: 'Available' },
  noise: { type: String, enum: ['Quiet', 'Low', 'Conversation'], default: 'Quiet' },
  amenities: { type: [String], default: [] },
  description: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  peakHours: { type: [Number], default: [15, 25, 45, 60, 75, 80, 85, 75, 70, 78, 65, 40, 25, 10] },
  decibels: { type: Number, default: 35 },
  mapCoordinates: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
  },
  communityReports: {
    seatsEasy: { type: Number, default: 0 },
    seatsFull: { type: Number, default: 0 },
    noiseQuiet: { type: Number, default: 0 },
    noiseLoud: { type: Number, default: 0 },
    lastReportAt: { type: Date, default: Date.now },
  },
});
const Space = mongoose.models.Space || mongoose.model('Space', SpaceSchema);

const UserSchema = new mongoose.Schema({
  googleId: String,
  email: { type: String, required: true },
  name: { type: String, required: true },
  picture: String,
  role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now },
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);
let memoryUsers = [];

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

const starterSpaces = [
  {
    name: 'Central Library · Silent Reading',
    building: 'Central Library',
    floor: '2nd floor',
    zone: 'Quiet',
    capacity: 48,
    occupiedSeats: 31,
    status: 'Available',
    noise: 'Quiet',
    decibels: 34,
    mapCoordinates: { x: 38, y: 32 },
    peakHours: [15, 25, 45, 60, 75, 80, 85, 75, 70, 78, 65, 40, 25, 10],
    amenities: ['Individual desks', 'Power outlets', 'Air conditioned', 'Wheelchair accessible', 'Natural light'],
    description: 'A calm, no-conversation zone for deep focus.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
  {
    name: 'Central Library · Discussion Nook',
    building: 'Central Library',
    floor: 'Ground floor',
    zone: 'Collaborative',
    capacity: 16,
    occupiedSeats: 13,
    status: 'Filling up',
    noise: 'Conversation',
    decibels: 64,
    mapCoordinates: { x: 45, y: 38 },
    peakHours: [20, 35, 50, 70, 85, 90, 85, 80, 85, 75, 55, 35, 20, 10],
    amenities: ['Group tables', 'Whiteboard', 'Power outlets', 'Natural light', 'Near cafe'],
    description: 'Open tables where small groups can work through ideas.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
  {
    name: 'Academic Block B · Study Lounge',
    building: 'Academic Block B',
    floor: '1st floor',
    zone: 'Mixed',
    capacity: 30,
    occupiedSeats: 11,
    status: 'Available',
    noise: 'Low',
    decibels: 46,
    mapCoordinates: { x: 74, y: 30 },
    peakHours: [10, 20, 35, 50, 65, 70, 65, 60, 65, 50, 35, 20, 15, 5],
    amenities: ['Shared tables', 'Natural light', 'Power outlets', 'Air conditioned'],
    description: 'A flexible space with room for quiet work and low-voice discussion.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
  {
    name: 'Learning Commons · Project Room',
    building: 'Learning Commons',
    floor: 'Ground floor',
    zone: 'Collaborative',
    capacity: 12,
    occupiedSeats: 12,
    status: 'Busy',
    noise: 'Conversation',
    decibels: 68,
    mapCoordinates: { x: 58, y: 65 },
    peakHours: [10, 30, 60, 80, 95, 100, 95, 90, 95, 80, 60, 40, 20, 10],
    amenities: ['Group tables', 'Display screen', 'Whiteboard', 'Power outlets', 'Air conditioned'],
    description: 'A team space for project planning and group assignments.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
  {
    name: 'Academic Block A · Reading Corner',
    building: 'Academic Block A',
    floor: '3rd floor',
    zone: 'Quiet',
    capacity: 22,
    occupiedSeats: 8,
    status: 'Available',
    noise: 'Quiet',
    decibels: 36,
    mapCoordinates: { x: 22, y: 46 },
    peakHours: [10, 15, 30, 45, 55, 60, 55, 50, 55, 45, 30, 20, 10, 5],
    amenities: ['Individual desks', 'Window seats', 'Power outlets', 'Natural light', 'Wheelchair accessible'],
    description: 'A tucked-away corner for solo reading and revision.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
  {
    name: 'Library Annex · Open Tables',
    building: 'Library Annex',
    floor: '1st floor',
    zone: 'Mixed',
    capacity: 26,
    occupiedSeats: 19,
    status: 'Filling up',
    noise: 'Low',
    decibels: 50,
    mapCoordinates: { x: 30, y: 74 },
    peakHours: [15, 25, 40, 65, 75, 80, 75, 70, 75, 60, 45, 30, 15, 10],
    amenities: ['Shared tables', 'Power outlets', 'Water nearby', 'Natural light'],
    description: 'Shared tables with a little more room to spread out.',
    communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
  },
];

let memorySpaces = starterSpaces.map((space, index) => ({
  ...space,
  _id: String(index + 1),
  updatedAt: new Date(Date.now() - (index + 1) * 5 * 60_000),
}));

function formatSpace(doc) {
  const space = doc && doc.toObject ? doc.toObject() : { ...doc };
  if (!space) return null;
  if (!space.mapCoordinates || !space.mapCoordinates.x) {
    const coordsMap = {
      'Central Library': { x: 40, y: 35 },
      'Academic Block A': { x: 22, y: 46 },
      'Academic Block B': { x: 74, y: 30 },
      'Learning Commons': { x: 58, y: 65 },
      'Library Annex': { x: 30, y: 74 },
    };
    space.mapCoordinates = coordsMap[space.building] || { x: 50, y: 50 };
  }
  if (!space.peakHours || space.peakHours.length === 0) {
    space.peakHours = [15, 25, 45, 65, 80, 85, 75, 70, 80, 65, 45, 30, 20, 10];
  }
  if (!space.decibels) {
    space.decibels = space.noise === 'Conversation' ? 65 : space.noise === 'Low' ? 48 : 35;
  }
  if (!space.communityReports) {
    space.communityReports = { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 };
  }
  return space;
}

const listSpaces = async () => {
  if (useMongo) {
    const spaces = await Space.find().sort({ building: 1, name: 1 }).lean();
    return spaces.map(formatSpace);
  }
  return memorySpaces.map(formatSpace);
};

const findSpace = async (id) => {
  if (useMongo) {
    return Space.findById(id);
  }
  return memorySpaces.find((space) => String(space._id) === String(id));
};

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  database: useMongo ? 'connected' : (process.env.MONGODB_URI ? 'demo-memory-fallback' : 'demo-memory'),
}));

app.post('/api/staff/verify', (req, res) => {
  if (!staffPin) return res.status(503).json({ error: 'Set STAFF_PIN on the server to enable staff controls.' });
  if (req.body?.pin !== staffPin) return res.status(401).json({ error: 'Incorrect staff PIN.' });
  res.json({ ok: true });
});

app.get('/api/auth/config', (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, profile } = req.body;
    let userData = null;

    if (credential) {
      const decoded = decodeJwt(credential);
      if (decoded && decoded.email) {
        userData = {
          googleId: decoded.sub,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0],
          picture: decoded.picture || '',
          role: decoded.email.includes('staff') || decoded.email.includes('admin') ? 'staff' : 'student',
        };
      }
    } else if (profile && profile.email) {
      userData = {
        googleId: profile.googleId || `demo-${Date.now()}`,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        picture: profile.picture || '',
        role: profile.role || 'student',
      };
    }

    if (!userData) {
      return res.status(400).json({ error: 'Valid Google credential or profile required.' });
    }

    if (useMongo) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = await User.create(userData);
      } else {
        user.name = userData.name;
        if (userData.picture) user.picture = userData.picture;
        user.lastLoginAt = new Date();
        await user.save();
      }
      res.json({
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
      });
    } else {
      let user = memoryUsers.find((u) => u.email === userData.email);
      if (!user) {
        user = { ...userData, id: String(Date.now()) };
        memoryUsers.push(user);
      } else {
        user.name = userData.name;
        if (userData.picture) user.picture = userData.picture;
        user.lastLoginAt = new Date();
      }
      res.json(user);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/spaces', async (req, res) => {
  try {
    let spaces = await listSpaces();
    if (req.query.zone && req.query.zone !== 'All' && req.query.zone !== 'All spaces') {
      spaces = spaces.filter((space) => space.zone === req.query.zone);
    }
    if (req.query.status && req.query.status !== 'All') {
      spaces = spaces.filter((space) => space.status === req.query.status);
    }
    if (req.query.q) {
      const query = req.query.q.toLowerCase();
      spaces = spaces.filter((space) =>
        `${space.name} ${space.building} ${(space.amenities || []).join(' ')}`.toLowerCase().includes(query)
      );
    }
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update occupancy/noise/status (Quick Staff Update)
app.patch('/api/spaces/:id', requireStaff, async (req, res) => {
  const { occupiedSeats, status, noise } = req.body;
  if (
    !['Available', 'Filling up', 'Busy'].includes(status) ||
    !['Quiet', 'Low', 'Conversation'].includes(noise) ||
    !Number.isInteger(occupiedSeats) ||
    occupiedSeats < 0
  ) {
    return res.status(400).json({ error: 'Provide a valid occupancy count, status, and noise level.' });
  }
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ error: 'Space not found.' });
    if (occupiedSeats > space.capacity) {
      return res.status(400).json({ error: `Count cannot exceed this space's capacity (${space.capacity}).` });
    }
    space.occupiedSeats = occupiedSeats;
    space.status = status;
    space.noise = noise;
    space.decibels = noise === 'Conversation' ? 64 : noise === 'Low' ? 48 : 34;
    space.updatedAt = new Date();
    const saved = useMongo ? await space.save() : space;
    res.json(formatSpace(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new space (Full Admin CRUD)
app.post('/api/spaces', requireStaff, async (req, res) => {
  try {
    const { name, building, floor, zone, capacity, occupiedSeats = 0, status = 'Available', noise = 'Quiet', amenities = [], description = '' } = req.body;
    if (!name || !building || !zone || !capacity) {
      return res.status(400).json({ error: 'Name, building, zone, and capacity are required.' });
    }
    const coordsMap = {
      'Central Library': { x: 40, y: 35 },
      'Academic Block A': { x: 22, y: 46 },
      'Academic Block B': { x: 74, y: 30 },
      'Learning Commons': { x: 58, y: 65 },
      'Library Annex': { x: 30, y: 74 },
    };
    const coords = req.body.mapCoordinates || coordsMap[building] || {
      x: Math.floor(25 + Math.random() * 50),
      y: Math.floor(25 + Math.random() * 45),
    };
    const peakHours = req.body.peakHours || [10, 20, 40, 60, 75, 80, 75, 70, 75, 60, 40, 25, 15, 10];
    const decibels = noise === 'Conversation' ? 65 : noise === 'Low' ? 48 : 34;

    const newSpaceData = {
      name,
      building,
      floor: floor || '1st floor',
      zone,
      capacity: Number(capacity),
      occupiedSeats: Number(occupiedSeats),
      status,
      noise,
      decibels,
      amenities: Array.isArray(amenities) ? amenities : amenities.split(',').map((s) => s.trim()).filter(Boolean),
      description: description || 'Study area on campus.',
      updatedAt: new Date(),
      peakHours,
      mapCoordinates: coords,
      communityReports: { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0 },
    };

    if (useMongo) {
      const created = await Space.create(newSpaceData);
      res.status(201).json(formatSpace(created));
    } else {
      const newSpace = { ...newSpaceData, _id: String(Date.now()) };
      memorySpaces.push(newSpace);
      res.status(201).json(newSpace);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update full space details (Admin CRUD)
app.put('/api/spaces/:id', requireStaff, async (req, res) => {
  try {
    const { name, building, floor, zone, capacity, occupiedSeats, status, noise, amenities, description } = req.body;
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ error: 'Space not found.' });

    if (name) space.name = name;
    if (building) space.building = building;
    if (floor) space.floor = floor;
    if (zone) space.zone = zone;
    if (capacity !== undefined) space.capacity = Number(capacity);
    if (occupiedSeats !== undefined) space.occupiedSeats = Math.min(Number(occupiedSeats), space.capacity);
    if (status) space.status = status;
    if (noise) {
      space.noise = noise;
      space.decibels = noise === 'Conversation' ? 65 : noise === 'Low' ? 48 : 34;
    }
    if (amenities) {
      space.amenities = Array.isArray(amenities) ? amenities : amenities.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (description !== undefined) space.description = description;
    space.updatedAt = new Date();

    const saved = useMongo ? await space.save() : space;
    res.json(formatSpace(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete space (Admin CRUD)
app.delete('/api/spaces/:id', requireStaff, async (req, res) => {
  try {
    if (useMongo) {
      const deleted = await Space.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Space not found.' });
    } else {
      const idx = memorySpaces.findIndex((s) => String(s._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ error: 'Space not found.' });
      memorySpaces.splice(idx, 1);
    }
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crowdsourced student feedback endpoint
app.post('/api/spaces/:id/feedback', async (req, res) => {
  try {
    const { type, value } = req.body; // type: 'seats'|'noise', value: 'easy'|'full'|'quiet'|'loud'
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ error: 'Space not found.' });

    if (!space.communityReports) {
      space.communityReports = { seatsEasy: 0, seatsFull: 0, noiseQuiet: 0, noiseLoud: 0, lastReportAt: new Date() };
    }

    if (type === 'seats') {
      if (value === 'easy') space.communityReports.seatsEasy = (space.communityReports.seatsEasy || 0) + 1;
      if (value === 'full') space.communityReports.seatsFull = (space.communityReports.seatsFull || 0) + 1;
    } else if (type === 'noise') {
      if (value === 'quiet') space.communityReports.noiseQuiet = (space.communityReports.noiseQuiet || 0) + 1;
      if (value === 'loud') space.communityReports.noiseLoud = (space.communityReports.noiseLoud || 0) + 1;
    }
    space.communityReports.lastReportAt = new Date();
    space.updatedAt = new Date();

    const saved = useMongo ? await space.save() : space;
    res.json(formatSpace(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset demo data endpoint
app.post('/api/reset', requireStaff, async (_req, res) => {
  try {
    if (useMongo) {
      await Space.deleteMany({});
      await Space.insertMany(starterSpaces);
    } else {
      memorySpaces = starterSpaces.map((space, index) => ({
        ...space,
        _id: String(index + 1),
        updatedAt: new Date(),
      }));
    }
    const spaces = await listSpaces();
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(__dirname, '../dist')));
app.get('*', (_req, res, next) => res.sendFile(path.resolve(__dirname, '../dist/index.html'), (error) => error && next()));

async function start() {
  if (useMongo) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      const count = await Space.countDocuments();
      if (count === 0) {
        await Space.insertMany(starterSpaces);
        console.log('Seeded initial study spaces to MongoDB.');
      }
      console.log('MongoDB connected');
    } catch (err) {
      console.warn('MongoDB connection failed; using in-memory demo data:', err.message);
      useMongo = false;
      await mongoose.disconnect().catch(() => {});
    }
  } else {
    console.log('Running demo data in memory. Add MONGODB_URI to persist updates.');
  }
  app.listen(PORT, HOST, () => console.log(`StudySpot server ready on http://${HOST}:${PORT}`));
}

// Start only if not in watch cluster duplicate
start().catch((error) => {
  console.error('Could not start server:', error.message);
});
