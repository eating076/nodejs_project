const express = require('express');
const mysql = require('mysql');
const app = express();
const port = 3000;

app.use(express.json());

// 設定 MySQL 連接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'cindy789125',
    database: 'my_test_project'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// 處理 POST 請求來新增用戶
app.post('/users', (req, res) => {
    const { name, email, age, address, phone } = req.body;
    const query = 'INSERT INTO users (name, email, age, address, phone) VALUES (?, ?, ?, ?, ?)';
    
    connection.query(query, [name, email, age, address, phone], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Error saving data');
            return;
        }
        res.send('User added successfully');
    });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

res.send('User added or updated successfully');
