require('dotenv').config();
console.log('Database URL:', process.env.DATABASE_URL);

const zmq = require('zeromq');      // ✅ Make sure this is also required
const API_KEY = process.env.API_KEY;
console.log("Loaded API KEY:", API_KEY);

const session = require('express-session');

const bcrypt = require('bcrypt');

const { Pool } = require('pg');

const axios = require('axios');

const {
  insertTripToDB,
  syncPackingItems,
  normalizeBudget,
  renderConfirmation,
  syncSavingsDataForTrip,
  syncTodoItems
} = require('./utils/tripHelpers');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Import the Express and Handlebars modules
const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3157;

const fs = require('fs');

// Path to your JSON file that stores trip data
const TRIP_DATA_FILE = path.join(__dirname, 'savings_data.json');

// Step 1: Create hbs instance (before registering helpers)
const hbs = exphbs.create({ extname: '.hbs' });

// Step 2: Register handlebars-helpers first
const helpers = require('handlebars-helpers')();
hbs.handlebars.registerHelper(helpers);

// Step 3: Register your custom helpers
hbs.handlebars.registerHelper('gte', (a, b) => parseFloat(a) >= parseFloat(b));
hbs.handlebars.registerHelper('eq', (a, b) => a === b);
hbs.handlebars.registerHelper('min', (a, b) => Math.min(parseFloat(a), parseFloat(b)));
hbs.handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
});
hbs.handlebars.registerHelper('add', (a, b) => {
  const numA = parseInt(a) || 0;
  const numB = parseInt(b) || 0;
  return numA + numB;
});
hbs.handlebars.registerHelper('getTripIcon', (type) => {
  switch (type) {
    case 'air': return '✈️';
    case 'road': return '🚗';
    case 'nature': return '🌲';
    case 'custom':
    default: return '🛠️';
  }
});
hbs.handlebars.registerHelper('json', (context) => {
  return JSON.stringify(context).replace(/</g, '\\u003c');
});

// Step 4: Apply hbs engine to express
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (like CSS) from /public
app.use(express.static(path.join(__dirname, 'public')));

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'smiles-secret-key', // use dotenv later
  resave: false,
  saveUninitialized: false
}));

const savedTrips = []; // Storing saved trip information

// Home
app.get('/', (req, res) => {
  res.render('home', { title: 'Welcome to s+miles' });
});

// Account
app.get('/account', (req, res) => {
  res.render('account', { title: 'My Account' });
});

// Saved Trips
app.get('/saved', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        trip_name,
        destination,
        start_date,
        end_date,
        travelers,
        transport,
        lodging,
        trip_type,
        destination_type,
        transport_budget,
        lodging_budget,
        saving,
        savings_goal,
        wants_packing,
        wants_todo,
        created_at
      FROM trips
      ORDER BY created_at DESC
    `);

    const trips = result.rows;

    for (let trip of trips) {
      await syncSavingsDataForTrip(trip);
    }

    res.render('saved', {
      title: 'My Saved Trips',
      trips: trips
    });
  } catch (err) {
    console.error('ERROR in /saved route:', err.stack);
    res.status(500).send('Could not load trips from database.');
  }
});

// About
app.get('/about', (req, res) => {
  res.render('about', { title: 'About' });
});

// Air Travel Form
app.get('/air', (req, res) => {
  res.render('air', {
    title: 'Air Travel Plan',
    pageHeading: 'Plan Your Air Travel Adventure',
    formAction: '/air',
    tripTypeFlag: 'air'
  });
});

// Road Trip Form
app.get('/road', (req, res) => {
  res.render('road', {
    title: 'Road Trip Plan',
    pageHeading: 'Plan Your Next Road Trip',
    formAction: '/road',
    tripTypeFlag: 'road'
  });
});

// Nature Retreat Form
app.get('/nature', (req, res) => {
  res.render('nature', {
    title: 'Nature Retreat',
    pageHeading: 'Plan Your Nature Getaway',
    formAction: '/nature',
    tripTypeFlag: 'nature'
  });
});

// Custom Form
app.get('/custom', (req, res) => {
  res.render('custom', {
    title: 'Custom Trip',
    pageHeading: 'Create Your Custom Trip Plan',
    formAction: '/custom'
  });
});

app.get('/trip/:tripName', async (req, res) => {
  const { tripName } = req.params;
  try {
    const result = await pool.query('SELECT * FROM trips WHERE trip_name = $1', [tripName]);
    const trip = result.rows[0];
    if (!trip) return res.status(404).send('Trip not found');

    // Fetch and update savings data
    await syncSavingsDataForTrip(trip);

    // Fetch packing list
    const packing = await axios.get(`http://localhost:3777/packing/${encodeURIComponent(tripName)}`);
    trip.packingList = packing.data;
    console.log(trip.packingList)

    try {
      const todoResponse = await axios.get(`http://localhost:3888/todo/${encodeURIComponent(tripName)}`);
      trip.todoList = todoResponse.data;
    } catch (todoErr) {
      console.warn(`No to-do list found for ${tripName}.`);
      trip.todoList = [];
    }

    res.render('tripDetail', { title: trip.trip_name, trip });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading trip');
  }
});

app.get('/convert', (req, res) => {
  res.render('converter', { title: 'Currency Converter' });
});

app.get('/edit/:tripName', async (req, res) => {
  const { tripName } = req.params;

  try {
    const result = await pool.query('SELECT * FROM trips WHERE trip_name = $1', [tripName]);
    const trip = result.rows[0];
    if (!trip) return res.status(404).send('Trip not found');

    // 🧠 Get packing list
    try {
      const packRes = await axios.get(`http://localhost:3777/packing/${encodeURIComponent(tripName)}`);
      trip.packingList = packRes.data;
    } catch (e) {
      console.warn(`No packing list found for ${tripName}`);
      trip.packingList = [];
    }

    // 🧠 Get to-do list + raw format
    try {
      const todoRes = await axios.get(`http://localhost:3888/todo/${encodeURIComponent(tripName)}`);
      trip.todoList = todoRes.data;
      trip.todoListRaw = trip.todoList.map(item => item.task).join('\n');
    } catch (e) {
      console.warn(`No todo list found for ${tripName}`);
      trip.todoList = [];
      trip.todoListRaw = '';
    }

    res.render('editTrip', {
      title: `Edit Trip: ${tripName}`,
      trip,
      formAction: '/edit/',
      tripTypeFlag: trip.trip_type
    });
  } catch (err) {
    console.error('Edit trip load failed:', err);
    res.status(500).send('Failed to load trip.');
  }
});

// Air Travel POST
app.post('/air', async (req, res) => {
  try {
    normalizeBudget(req, 'air');
    await insertTripToDB(req);

    if (req.body.wantsPacking === 'yes') {
      await syncPackingItems(req.body.tripName, req.body.packingItems);
    }

    if (req.body.todoItems) {
      const todoLines = req.body.todoItems.split('\n').map(line => line.trim()).filter(Boolean);
      await syncTodoItems(req.body.tripName, todoLines);
    }

    renderConfirmation(res, req.body.tripName, req.body.flightBudget);
  } catch (err) {
    console.error('Error saving air trip:', err);
    res.status(500).send('Failed to save air trip.');
  }
});

// Road Trip POST
app.post('/road', async (req, res) => {
  try {
    normalizeBudget(req, 'road');
    await insertTripToDB(req);

    if (req.body.wantsPacking === 'yes') {
      await syncPackingItems(req.body.tripName, req.body.packingItems);
    }
  
    if (req.body.todoItems) {
      const todoLines = req.body.todoItems.split('\n').map(line => line.trim()).filter(Boolean);
      await syncTodoItems(req.body.tripName, todoLines);
    }

    renderConfirmation(res, req.body.tripName, req.body.roadBudget);
  } catch (err) {
    console.error('Error saving road trip:', err);
    res.status(500).send('Failed to save road trip.');
  }
});

// Nature Retreat POST
app.post('/nature', async (req, res) => {
  try {
    normalizeBudget(req, 'nature');
    await insertTripToDB(req);

    if (req.body.wantsPacking === 'yes') {
      await syncPackingItems(req.body.tripName, req.body.packingItems);
    }

    if (req.body.todoItems) {
      const todoLines = req.body.todoItems.split('\n').map(line => line.trim()).filter(Boolean);
      await syncTodoItems(req.body.tripName, todoLines);
    }

    renderConfirmation(res, req.body.tripName, req.body.natureBudget);
  } catch (err) {
    console.error('Error saving nature trip:', err);
    res.status(500).send('Failed to save nature trip.');
  }
});

// Custom Trip POST
app.post('/custom', async (req, res) => {
  try {
    await insertTripToDB(req);

    if (req.body.wantsPacking === 'yes') {
      await syncPackingItems(req.body.tripName, req.body.packingItems);
    }

    if (req.body.todoItems) {
      const todoLines = req.body.todoItems.split('\n').map(line => line.trim()).filter(Boolean);
      await syncTodoItems(req.body.tripName, todoLines);
    }

    renderConfirmation(
      res,
      req.body.tripName,
      req.body.transportBudget || req.body.lodgingBudget
    );
  } catch (err) {
    console.error('Error saving custom trip:', err);
    res.status(500).send('Failed to save custom trip.');
  }
});

// Savings POST (Trip Details)
app.post('/savings/add', async (req, res) => {
  const { trip_id, amount } = req.body;

  try {
    await axios.patch(`http://localhost:3760/savings/${encodeURIComponent(trip_id)}`, {
      amount: parseFloat(amount)
    });
    console.log(`Added $${amount} to savings for ${trip_id}`);
    res.redirect(`/trip/${encodeURIComponent(trip_id)}`);
  } catch (err) {
    console.error('Savings update failed:', err.message);
    res.redirect(`/trip/${encodeURIComponent(trip_id)}`);
  }
});

// Currency converting POST
app.post('/convert', async (req, res) => {
  const { from, to, amount } = req.body;
  const sock = new zmq.Request();

  try {
    await sock.connect("tcp://localhost:7777");
    await sock.send(JSON.stringify({ from, to, amount, api_key: API_KEY }));

    const [raw] = await sock.receive();
    const converted = JSON.parse(raw.toString()).converted_amount;

    res.json({ converted });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'Conversion failed.' });
  }
});

app.post('/edit/:tripName', async (req, res) => {
  const { tripName } = req.params;
  let {
    destination,
    start_date,
    end_date,
    travelers,
    transport,
    transport_budget,
    lodging,
    lodging_budget,
    savings_goal,
    destination_type,
    saving,
    wantsPacking,
    wantsTodo,
    packingItems,
    todoItems
  } = req.body;

  // 🧹 Normalize transport and lodging to arrays (even if only one checkbox was selected)
  if (!Array.isArray(transport)) {
    transport = transport ? [transport] : [];
  }
  if (!Array.isArray(lodging)) {
    lodging = lodging ? [lodging] : [];
  }

  try {
    await pool.query(
      `UPDATE trips
       SET destination = $1,
           start_date = $2,
           end_date = $3,
           travelers = $4,
           transport = $5,
           transport_budget = $6,
           lodging = $7,
           lodging_budget = $8,
           savings_goal = $9,
           destination_type = $10,
           saving = $11,
           wants_packing = $12,
           wants_todo = $13
       WHERE trip_name = $14`,
      [
        destination,
        start_date,
        end_date,
        travelers,
        transport,         // ✅ now always an array
        transport_budget,
        lodging,           // ✅ now always an array
        lodging_budget,
        savings_goal,
        destination_type,
        saving,
        wantsPacking,
        wantsTodo,
        tripName
      ]
    );

    // 🔄 Sync packing list
    if (wantsPacking === 'yes' && packingItems) {
      await syncPackingItems(tripName, packingItems);
    }

    // 🔄 Sync to-do list
    if (todoItems) {
      const todoLines = todoItems
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      await syncTodoItems(tripName, todoLines);
    }

    res.redirect(`/trip/${encodeURIComponent(tripName)}`);
  } catch (err) {
    console.error('Failed to update trip:', err);
    res.status(500).send('Trip update failed.');
  }
});

app.post('/delete/:trip_id', async (req, res) => {
  const tripId = req.params.trip_id;

  try {
    await pool.query('DELETE FROM trips WHERE trip_name = $1', [tripId]);
    res.redirect('/saved');
  } catch (err) {
    console.error('Failed to delete trip:', err);
    res.status(500).send('Failed to delete trip.');
  }
});

// Define data functions early so they’re available below
function loadData() {
  if (!fs.existsSync(TRIP_DATA_FILE)) {
    fs.writeFileSync(TRIP_DATA_FILE, '{}', 'utf8');
  }
  const fileContent = fs.readFileSync(TRIP_DATA_FILE, 'utf8');
  return JSON.parse(fileContent || '{}');
}

function saveData(data) {
  fs.writeFileSync(TRIP_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
