const axios = require('axios');
const { Pool } = require('pg');

// Shared pool instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function insertTripToDB(req) {
  const {
    tripName,
    destination,
    startDate,
    endDate,
    travelers,
    transport,
    transportBudget,
    lodging,
    lodgingBudget,
    tripType,
    destinationType,
    saving,
    savingsGoal,
    wantsPacking,
    wantsTodo
  } = req.body;

  await pool.query(
    `INSERT INTO trips (
      trip_name, destination, start_date, end_date, travelers,
      transport, transport_budget, lodging, lodging_budget,
      trip_type, destination_type, saving, savings_goal,
      wants_packing, wants_todo
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15
    )`,
    [
      tripName,
      destination,
      startDate,
      endDate,
      travelers || null,
      Array.isArray(transport) ? transport : [transport],
      transportBudget || null,
      Array.isArray(lodging) ? lodging : [lodging],
      lodgingBudget || null,
      tripType,
      destinationType,
      saving,
      savingsGoal || null,
      wantsPacking,
      wantsTodo
    ]
  );
}

async function syncPackingItems(tripName, packingItems) {
  const tripId = encodeURIComponent(tripName);
  const items = Array.isArray(packingItems) ? packingItems : [packingItems];

  for (const item of items) {
    if (item && item.trim()) {
      await axios.post(`http://localhost:3777/packing/${tripId}`, {
        item: item.trim()
      });
    }
  }
}

// 🔄 Normalizes transportBudget from trip-type-specific budget field
function normalizeBudget(req, type) {
  if (type === 'air') req.body.transportBudget = req.body.flightBudget || null;
  else if (type === 'road') req.body.transportBudget = req.body.roadBudget || null;
  else if (type === 'nature') req.body.transportBudget = req.body.natureBudget || null;
}

// 🎉 Renders confirmation with fallback budget
function renderConfirmation(res, tripName, budget) {
  res.render('confirmation', {
    title: 'Trip Saved!',
    tripName,
    budget: budget || 'N/A'
  });
}

async function syncSavingsDataForTrip(trip) {
  const tripId = encodeURIComponent(trip.trip_name);
  const goal = parseFloat(trip.savings_goal) || 0;

  try {
    const response = await axios.get(`http://localhost:3760/savings/${tripId}`);

    await axios.patch(`http://localhost:3760/savings/${tripId}`, {
      goal: goal
    });

    trip.savings_goal = goal;
    trip.savings_saved = response.data.saved;
    trip.savings_percent = response.data.percent;
    trip.savings_celebrated = response.data.celebrated;
  } catch (err) {
    console.warn(`No savings found for ${trip.trip_name}. Creating with goal $${goal}...`);

    try {
      await axios.post(`http://localhost:3760/savings`, {
        trip_id: trip.trip_name,
        goal: goal
      });

      trip.savings_goal = goal;
      trip.savings_saved = 0;
      trip.savings_percent = 0;
    } catch (postErr) {
      console.error(`Failed to create savings goal: ${postErr.message}`);
      trip.savings_goal = goal;
      trip.savings_saved = 0;
      trip.savings_percent = 0;
    }
  }
}

async function syncTodoItems(tripName, todoItems) {
  const tripId = encodeURIComponent(tripName);
  const items = Array.isArray(todoItems) ? todoItems : [todoItems];

  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed) {
      await axios.post(`http://localhost:3888/todo/${tripId}`, {
        task: trimmed
      });
    }
  }
}


module.exports = {
  insertTripToDB,
  syncPackingItems,
  normalizeBudget,
  renderConfirmation,
  syncSavingsDataForTrip,
  syncTodoItems
};
