// Import the Express and Handlebars modules
const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3157;

// Set up Handlebars as the view engine
app.engine('hbs', exphbs.engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (like CSS) from /public
app.use(express.static(path.join(__dirname, 'public')));

// Home route – renders the homepage
app.get('/', (req, res) => {
  res.render('home', { title: 'Welcome to s+miles' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
