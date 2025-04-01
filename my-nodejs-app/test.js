const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3306;

app.use(bodyParser.json());


const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'cindy789125',
  database: 'my_test_project'
});

connection.connect((err) => {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }
  console.log('connected to MySQL as id ' + connection.threadId);
});




app.post('/users', (req, res) => {
  const { name, email, age } = req.body;
  const query = 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)';
  connection.query(query, [name, email, age], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(201).send({ userId: results.insertId });
    }
  });
});


app.post('/surveys', (req, res) => {
  const { user_id, question, answer } = req.body;
  const query = 'INSERT INTO surveys (user_id, question, answer) VALUES (?, ?, ?)';
  connection.query(query, [user_id, question, answer], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(201).send({ surveyId: results.insertId });
    }
  });
});


app.get('/surveys', (req, res) => {
  const query = 'SELECT * FROM surveys';
  connection.query(query, (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(results);
    }
  });
});


app.get('/users/:id/surveys', (req, res) => {
  const userId = req.params.id;
  const query = 'SELECT * FROM surveys WHERE user_id = ?';
  connection.query(query, [userId], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(results);
    }
  });
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



