const express = require('express');
const mysql = require('mysql');
const dayjs = require('dayjs');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', 'page');

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

app.use((req, res, next) => {
    console.log(`有新訪客 : 來自 ${req.hostname} | 請求頁面 ${req.path}`);
    next();
});

// 新增 logActivity 函數
function logActivity(userId, action, ipAddress, userAgent, details) {
    if (!userId) {
        console.warn('User ID is null, activity not logged:', { action, ipAddress, userAgent, details });
        return;
    }
    // 確保 userId 在使用前已正確賦值

    const logQuery = `
        INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details)
        VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(logQuery, [userId, action, ipAddress, userAgent, details], (err, result) => {
        if (err) {
            console.error('Error logging activity:', err);
            return;
        }
        console.log('Activity logged:', result);
    });
}

// 使用 logActivity 函數記錄活動日誌
app.use((req, res, next) => {
    const userId = req.body.userId || null;
    const action = req.method + ' ' + req.originalUrl;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const details = JSON.stringify(req.body);

    // 僅在 userId 存在時記錄活動日誌
    logActivity(userId, action, ipAddress, userAgent, details);
    next();
});


app.get('/', (req, res) => { res.render('index'); });

// 取得資料庫中的使用者
app.get('/index', (req, res) => {
    const query = 'SELECT * FROM users'; // 替換為你的資料表名稱
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('資料庫查詢失敗');
        }
        res.render('index', { index: results });
    });
});

// 獲取所有 users
app.get('/users', (req, res) => {
    const query = 'SELECT * FROM users';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error fetching data: ${err.message}`);
            return;
        }
        res.json(results);
    });
});

// 根據 user_id 獲取特定用戶
app.get('/users/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const query = 'SELECT * FROM users WHERE user_id = ?';
   
    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error fetching data: ${err.message}`);
            return;
        }
       
        if (results.length === 0) {
            res.status(404).send('User not found');
        } else {
            res.json(results[0]);
        }
    });
});
// 新增用戶 (POST)
app.post('/users', (req, res) => {
    const {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    // 驗證必需字段是否存在
    if (!user_name) {
        return res.status(400).send("Name cannot be null");
    }

    console.log('Received data:', {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    });

    // 獲取客戶端 IP 地址
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);
    const userAgent = req.headers['user-agent'];

    // 檢查是否已存在相同名字的記錄
    const checkQuery = 'SELECT user_id FROM users WHERE user_name = ?';
    connection.query(checkQuery, [user_name], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }

        const userId = results.length > 0 ? results[0].user_id : null;

        if (userId) {
            // 若存在相同名字的記錄，更新該記錄
            const updateQuery = `
                UPDATE users
                SET user_email = ?, user_gender = ?, user_salutation = ?, user_birthdate = ?, user_age = ?,
                    user_address = ?, user_phone = ?, user_id_number = ?, user_height = ?, user_weight = ?,
                    user_blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
                    betel_nut_habit = ?, allergies = ?
                WHERE user_id = ?;
            `;
            connection.query(updateQuery, [
                user_email, user_gender, user_salutation, user_birthdate, user_age,
                user_address, user_phone, user_id_number, user_height, user_weight,
                user_blood_type, emergency_contact_name, emergency_contact_phone,
                betel_nut_habit, allergies, userId
            ], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send(`Error updating data: ${err.message}`);
                    return;
                }
                console.log('Update result:', result);

                // 記錄活動日誌
                const action = 'User updated';
                const details = JSON.stringify(req.body);

                const logQuery = `
                    INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details)
                    VALUES (?, ?, ?, ?, ?)
                `;

                connection.query(logQuery, [userId, action, ipAddress, userAgent, details], (err, result) => {
                    if (err) {
                        console.error('Error logging activity:', err);
                        res.status(500).send(`Error logging activity: ${err.message}`);
                        return;
                    }
                    console.log('Activity logged:', result);
                   
                    res.redirect(`/result?user_id=${userId}`);
                });
            });
        } else {
            // 新增新記錄
            const insertQuery = `
                INSERT INTO users (user_name, user_email, user_gender, user_salutation, user_birthdate,
                    user_age, user_address, user_phone, user_id_number, user_height, user_weight,
                    user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            connection.query(insertQuery, [
                user_name, user_email, user_gender, user_salutation, user_birthdate,
                user_age, user_address, user_phone, user_id_number, user_height, user_weight,
                user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
            ], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send(`Error saving data: ${err.message}`);
                    return;
                }
                console.log('Insert result:', result);

                const newUserId = result.insertId; // 獲取新插入用戶的 ID
                // 記錄活動日誌
                const action = 'User created';
                const details = JSON.stringify(req.body);

                const logQuery = `
                    INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details)
                    VALUES (?, ?, ?, ?, ?)
                `;

                connection.query(logQuery, [newUserId, action, ipAddress, userAgent, details], (err, result) => {
                    if (err) {
                        console.error('Error logging activity:', err);
                        res.status(500).send(`Error logging activity: ${err.message}`);
                        return;
                    }
                    console.log('Activity logged:', result);
                   
                    // 將 user_id 作為 URL 參數傳遞到 about 頁面
                    res.redirect(`/result?user_id=${newUserId}`);
                });
            });
        }
    });
});


// 更新用戶資料
app.put('/users/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies } = req.body;


    const checkQuery = 'SELECT user_id FROM users WHERE user_email = ? AND user_id != ?';
    connection.query(checkQuery, [user_email, userId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }


        if (results.length > 0) {
            res.status(400).send('Duplicate email found');
        } else {
            const updateQuery = `
                UPDATE users
                SET user_name = ?, user_email = ?, user_gender = ?, user_salutation = ?, user_birthdate = ?, user_age = ?,
                    user_address = ?, user_phone = ?, user_id_number = ?, user_height = ?, user_weight = ?,
                    user_blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
                    betel_nut_habit = ?, allergies = ?
                WHERE user_id = ?;
            `;
            connection.query(updateQuery, [
                user_name, user_email, user_gender, user_salutation, user_birthdate, user_age,
                user_address, user_phone, user_id_number, user_height, user_weight,
                user_blood_type, emergency_contact_name, emergency_contact_phone,
                betel_nut_habit, allergies, userId
            ], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send(`Error updating data: ${err.message}`);
                    return;
                }
                console.log('Update result:', result);
                res.send('User updated successfully');
            });
        }
    });
});




// 刪除用戶
app.delete('/users/:user_id', (req, res) => {
    const userId = req.params.user_id;


    const deleteQuery = 'DELETE FROM users WHERE user_id = ?';
    connection.query(deleteQuery, [userId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        if (result.affectedRows === 0) {
            res.status(404).send('User not found');
        } else {
            res.send('User deleted successfully');
        }
    });
});
// 獲取模糊查詢結果 (GET)
app.get('/fuzzy_search', (req, res) => {
    const searchName = req.query.name;
    if (!searchName) {
        return res.status(400).send('Name query parameter is required');
    }

    const query = 'SELECT user_name, page_link FROM fuzzy_search WHERE user_name LIKE ?';
    connection.query(query, [`%${searchName}%`], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error fetching data: ${err.message}`);
        }

        // 返回符合條件的結果
        res.render('fuzzy_search', { fuzzy_search: results });
    });
});

// 獲取特定用戶 (GET by ID)
app.get('/fuzzy_search/:user_id', (req, res) => {
    const userId = req.params.user_id;

    const query = `SELECT * FROM fuzzy_search WHERE user_id = ?`;
    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error fetching data: ${err.message}`);
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        res.render('fuzzy_search', { fuzzy_search: results });
    });
});

// 其他 CRUD 操作
// 新增用戶 (POST)
app.post('/fuzzy_search', (req, res) => {
    const { user_name, page_link } = req.body;

    if (!user_name || !page_link) {
        return res.status(400).send('user_name and page_link are required');
    }

    const insertQuery = `INSERT INTO fuzzy_search (user_name, page_link) VALUES (?, ?)`;
    connection.query(insertQuery, [user_name, page_link], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error saving data: ${err.message}`);
        }
        res.status(201).json({ userId: result.insertId });
    });
});

// 更新用戶 (PUT)
app.put('/fuzzy_search/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { user_name, page_link } = req.body;

    if (!user_name || !page_link) {
        return res.status(400).send('user_name and page_link are required');
    }

    const updateQuery = `UPDATE fuzzy_search SET user_name = ?, page_link = ? WHERE user_id = ?`;
    connection.query(updateQuery, [user_name, page_link, userId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error updating data: ${err.message}`);
        }

        if (result.affectedRows === 0) {
            return res.status(404).send('User not found');
        }

        res.send('User updated successfully');
    });
});

// 刪除用戶 (DELETE)
app.delete('/fuzzy_search/:user_id', (req, res) => {
    const userId = req.params.user_id;

    const deleteQuery = `DELETE FROM fuzzy_search WHERE user_id = ?`;
    connection.query(deleteQuery, [userId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error deleting data: ${err.message}`);
        }

        if (result.affectedRows === 0) {
            return res.status(404).send('User not found');
        }

        res.send('User deleted successfully');
    });
});

// about 頁面 GET 請求
app.get('/result', (req, res) => {
    res.render('result', {
        user_name: req.query.user_name,
        user_email: req.query.user_email,
        user_gender: req.query.user_gender,
        user_salutation: req.query.user_salutation,
        user_birthdate: req.query.user_birthdate,
        user_age: req.query.user_age,
        user_address: req.query.user_address,
        user_phone: req.query.user_phone,
        user_id_number: req.query.user_id_number,
        user_height: req.query.user_height,
        user_weight: req.query.user_weight,
        user_blood_type: req.query.user_blood_type,
        emergency_contact_name: req.query.emergency_contact_name,
        emergency_contact_phone: req.query.emergency_contact_phone,
        betel_nut_habit: req.query.betel_nut_habit,
        allergies: req.query.allergies
    });
});




// about 頁面 POST 請求
app.post('/result', (req, res) => {
    const {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;


    const query = `
        INSERT INTO users (user_name, user_email, user_gender, user_salutation, user_birthdate,
            user_age, user_address, user_phone, user_id_number, user_height, user_weight,
            user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;


    connection.query(query, [
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }


        console.log('Insert result:', result);


        res.redirect(`/result?user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_gender=${encodeURIComponent(user_gender)}&user_salutation=${encodeURIComponent(user_salutation)}&user_birthdate=${encodeURIComponent(user_birthdate)}&user_age=${encodeURIComponent(user_age)}&user_address=${encodeURIComponent(user_address)}&user_phone=${encodeURIComponent(user_phone)}&user_id_number=${encodeURIComponent(user_id_number)}&user_height=${encodeURIComponent(user_height)}&user_weight=${encodeURIComponent(user_weight)}&user_blood_type=${encodeURIComponent(user_blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
    });
});

app.get('/result1', (req, res) => {
    res.render('result1', {
        user_name: req.query.user_name,
        user_email: req.query.user_email,
        user_gender: req.query.user_gender,
        user_salutation: req.query.user_salutation,
        user_birthdate: req.query.user_birthdate,
        user_age: req.query.user_age,
        user_address: req.query.user_address,
        user_phone: req.query.user_phone,
        user_id_number: req.query.user_id_number,
        user_height: req.query.user_height,
        user_weight: req.query.user_weight,
        user_blood_type: req.query.user_blood_type,
        emergency_contact_name: req.query.emergency_contact_name,
        emergency_contact_phone: req.query.emergency_contact_phone,
        betel_nut_habit: req.query.betel_nut_habit,
        allergies: req.query.allergies
    });
});

app.post('/result1', (req, res) => {
    const {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    const query = `
        INSERT INTO users (user_name, user_email, user_gender, user_salutation, user_birthdate,
            user_age, user_address, user_phone, user_id_number, user_height, user_weight,
            user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }

        console.log('Insert result:', result);

        res.redirect(`/result1?user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_gender=${encodeURIComponent(user_gender)}&user_salutation=${encodeURIComponent(user_salutation)}&user_birthdate=${encodeURIComponent(user_birthdate)}&user_age=${encodeURIComponent(user_age)}&user_address=${encodeURIComponent(user_address)}&user_phone=${encodeURIComponent(user_phone)}&user_id_number=${encodeURIComponent(user_id_number)}&user_height=${encodeURIComponent(user_height)}&user_weight=${encodeURIComponent(user_weight)}&user_blood_type=${encodeURIComponent(user_blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
    });
});

app.get('/result2', (req, res) => {
    res.render('result2', {
        user_name: req.query.user_name,
        user_email: req.query.user_email,
        user_gender: req.query.user_gender,
        user_salutation: req.query.user_salutation,
        user_birthdate: req.query.user_birthdate,
        user_age: req.query.user_age,
        user_address: req.query.user_address,
        user_phone: req.query.user_phone,
        user_id_number: req.query.user_id_number,
        user_height: req.query.user_height,
        user_weight: req.query.user_weight,
        user_blood_type: req.query.user_blood_type,
        emergency_contact_name: req.query.emergency_contact_name,
        emergency_contact_phone: req.query.emergency_contact_phone,
        betel_nut_habit: req.query.betel_nut_habit,
        allergies: req.query.allergies
    });
});

// result2 POST 請求
app.post('/result2', (req, res) => {
    const {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    const query = `
        INSERT INTO users (user_name, user_email, user_gender, user_salutation, user_birthdate,
            user_age, user_address, user_phone, user_id_number, user_height, user_weight,
            user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }

        console.log('Insert result:', result);

        res.redirect(`/result2?user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_gender=${encodeURIComponent(user_gender)}&user_salutation=${encodeURIComponent(user_salutation)}&user_birthdate=${encodeURIComponent(user_birthdate)}&user_age=${encodeURIComponent(user_age)}&user_address=${encodeURIComponent(user_address)}&user_phone=${encodeURIComponent(user_phone)}&user_id_number=${encodeURIComponent(user_id_number)}&user_height=${encodeURIComponent(user_height)}&user_weight=${encodeURIComponent(user_weight)}&user_blood_type=${encodeURIComponent(user_blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
    });
});

app.get('/result3', (req, res) => {
    res.render('result3', {
        user_name: req.query.user_name,
        user_email: req.query.user_email,
        user_gender: req.query.user_gender,
        user_salutation: req.query.user_salutation,
        user_birthdate: req.query.user_birthdate,
        user_age: req.query.user_age,
        user_address: req.query.user_address,
        user_phone: req.query.user_phone,
        user_id_number: req.query.user_id_number,
        user_height: req.query.user_height,
        user_weight: req.query.user_weight,
        user_blood_type: req.query.user_blood_type,
        emergency_contact_name: req.query.emergency_contact_name,
        emergency_contact_phone: req.query.emergency_contact_phone,
        betel_nut_habit: req.query.betel_nut_habit,
        allergies: req.query.allergies
    });
});

// result2 POST 請求
app.post('/result3', (req, res) => {
    const {
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    const query = `
        INSERT INTO users (user_name, user_email, user_gender, user_salutation, user_birthdate,
            user_age, user_address, user_phone, user_id_number, user_height, user_weight,
            user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [
        user_name, user_email, user_gender, user_salutation, user_birthdate,
        user_age, user_address, user_phone, user_id_number, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }

        console.log('Insert result:', result);

        res.redirect(`/result3?user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_gender=${encodeURIComponent(user_gender)}&user_salutation=${encodeURIComponent(user_salutation)}&user_birthdate=${encodeURIComponent(user_birthdate)}&user_age=${encodeURIComponent(user_age)}&user_address=${encodeURIComponent(user_address)}&user_phone=${encodeURIComponent(user_phone)}&user_id_number=${encodeURIComponent(user_id_number)}&user_height=${encodeURIComponent(user_height)}&user_weight=${encodeURIComponent(user_weight)}&user_blood_type=${encodeURIComponent(user_blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
    });
});


// 獲取所有步數統計資料
app.get('/steps', (req, res) => {
    const query = 'SELECT * FROM steps';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('steps', { steps: results });
    });
});


// 根據 step_id 獲取特定步數統計資料
app.get('/steps/:step_id', (req, res) => {
    const stepId = req.params.step_id;
    const query = 'SELECT * FROM steps WHERE step_id = ?';
    connection.query(query, [stepId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Step data not found');
        }
    });
});
// 新增步數統計資料
app.post('/steps', (req, res) => {
    const { user_id, step_date, steps, goal } = req.body;
    if (!user_id || !step_date || !steps || !goal) {
        return res.status(400).send('user_id, step_date, steps, and goal are required');
    }
    const completionRate = ((steps / goal) * 100).toFixed(2);


    const query = `
        INSERT INTO steps (user_id, step_date, steps, goal, completion_rate)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            step_date = VALUES(step_date),
            steps = VALUES(steps),
            goal = VALUES(goal),
            completion_rate = VALUES(completion_rate);
    `;


    connection.query(query, [user_id, step_date, steps, goal, completionRate], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});
// 更新步數統計資料
app.put('/steps/:step_id', (req, res) => {
    const stepId = req.params.step_id;
    const { step_date, steps, goal } = req.body;
    const completionRate = ((steps / goal) * 100).toFixed(2);


    const query = `
        UPDATE steps
        SET step_date = ?, steps = ?, goal = ?, completion_rate = ?
        WHERE step_id = ?
    `;


    connection.query(query, [step_date, steps, goal, completionRate, stepId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});


// 刪除步數統計資料
app.delete('/steps/:step_id', (req, res) => {
    const stepId = req.params.step_id;
   
    const query = 'DELETE FROM steps WHERE step_id = ?';
   
    connection.query(query, [stepId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        console.log('Delete result:', result);
        res.send('Data deleted successfully');
    });
});
app.get('/scores', (req, res) => {
    res.render('scores');
});
app.get('/support_assessment', (req, res) => {
    const query = 'SELECT * FROM support_assessment';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('support_assessment', { assessments: results });
    });
});




app.get('/support_assessment/:support_assessment_id', (req, res) => {
    const assessmentId = req.params.support_assessment_id;
    const query = 'SELECT * FROM support_assessment WHERE support_assessment_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Support assessment not found');
        }
    });
});




app.post('/support_assessment', (req, res) => {
    const { user_id, support_assessment_test_date, support_assessment_score, support_assessment_follow_up_required } = req.body;
    if (!user_id || !support_assessment_test_date || !support_assessment_score || support_assessment_follow_up_required === undefined) {
        return res.status(400).send('User ID, support assessment test date, support assessment score, and follow-up requirement cannot be null');
    }


    const query = 'INSERT INTO support_assessment (user_id, support_assessment_test_date, support_assessment_score, support_assessment_follow_up_required) VALUES (?, ?, ?, ?)';
    connection.query(query, [user_id, support_assessment_test_date, support_assessment_score, support_assessment_follow_up_required], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Support assessment saved successfully');
    });
});




app.put('/support_assessment/:support_assessment_id', (req, res) => {
    const assessmentId = req.params.support_assessment_id;
    const { user_id, support_assessment_test_date, support_assessment_score, support_assessment_follow_up_required } = req.body;


    const query = 'UPDATE support_assessment SET user_id = ?, support_assessment_test_date = ?, support_assessment_score = ?, support_assessment_follow_up_required = ? WHERE support_assessment_id = ?';
    connection.query(query, [user_id, support_assessment_test_date, support_assessment_score, support_assessment_follow_up_required, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Support assessment updated successfully');
    });
});




app.delete('/support_assessment/:support_assessment_id', (req, res) => {
    const assessmentId = req.params.support_assessment_id;


    const query = 'DELETE FROM support_assessment WHERE support_assessment_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Support assessment deleted successfully');
    });
});
app.get('/attachment_support', (req, res) => {
    const query = 'SELECT * FROM attachment_support';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('attachment_support', { assessments: results });
    });
});
app.get('/attachment_support/:attachment_support_id', (req, res) => {
    const assessmentId = req.params.attachment_support_id;
    const query = 'SELECT * FROM attachment_support WHERE attachment_support_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Attachment support assessment not found');
        }
    });
});
app.post('/attachment_support', (req, res) => {
    const { user_id, attachment_support_test_date, attachment_support_score, attachment_support_follow_up_required } = req.body;
    if (!user_id || !attachment_support_test_date || !attachment_support_score || attachment_support_follow_up_required === undefined) {
        return res.status(400).send('User ID, attachment support test date, attachment support score, and follow-up requirement cannot be null');
    }


    const query = 'INSERT INTO attachment_support (user_id, attachment_support_test_date, attachment_support_score, attachment_support_follow_up_required) VALUES (?, ?, ?, ?)';
    connection.query(query, [user_id, attachment_support_test_date, attachment_support_score, attachment_support_follow_up_required], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Attachment support assessment saved successfully');
    });
});
app.put('/attachment_support/:attachment_support_id', (req, res) => {
    const assessmentId = req.params.attachment_support_id;
    const { user_id, attachment_support_test_date, attachment_support_score, attachment_support_follow_up_required } = req.body;


    const query = 'UPDATE attachment_support SET user_id = ?, attachment_support_test_date = ?, attachment_support_score = ?, attachment_support_follow_up_required = ? WHERE attachment_support_id = ?';
    connection.query(query, [user_id, attachment_support_test_date, attachment_support_score, attachment_support_follow_up_required, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Attachment support assessment updated successfully');
    });
});
app.delete('/attachment_support/:attachment_support_id', (req, res) => {
    const assessmentId = req.params.attachment_support_id;


    const query = 'DELETE FROM attachment_support WHERE attachment_support_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Attachment support assessment deleted successfully');
    });
});

// 獲取所有測驗數據 (GET)
app.get('/dour', (req, res) => {
    const query = 'SELECT * FROM dour';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('dour', { assessments: results });
    });
});

// 獲取特定測驗數據 (GET by ID)
app.get('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;
    const query = 'SELECT * FROM dour WHERE dour_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Dour assessment not found');
        }
    });
});

// 新增測驗數據 (POST)
app.post('/dour', (req, res) => {
    const { stage, test_date, stress_index, weight_change, depression_index, test_score } = req.body;
    if (!stage || !test_date || !stress_index || !weight_change || !depression_index || !test_score) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO dour (stage, test_date, stress_index, weight_change, depression_index, test_score) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(query, [stage, test_date, stress_index, weight_change, depression_index, test_score], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Dour assessment saved successfully');
    });
});

// 更新測驗數據 (PUT)
app.put('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;
    const { stage, test_date, stress_index, weight_change, depression_index, test_score } = req.body;

    const query = 'UPDATE dour SET stage = ?, test_date = ?, stress_index = ?, weight_change = ?, depression_index = ?, test_score = ? WHERE dour_id = ?';
    connection.query(query, [stage, test_date, stress_index, weight_change, depression_index, test_score, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Dour assessment updated successfully');
    });
});

// 刪除測驗數據 (DELETE)
app.delete('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;

    const query = 'DELETE FROM dour WHERE dour_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Dour assessment deleted successfully');
    });
});

// 獲取所有疼痛測量數據 (GET)
app.get('/hurt', (req, res) => {
    const query = 'SELECT * FROM hurt';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('hurt', { assessments: results });
    });
});

// 獲取特定疼痛測量數據 (GET by ID)
app.get('/hurt/:hurt_id', (req, res) => {
    const assessmentId = req.params.hurt_id;
    const query = 'SELECT * FROM hurt WHERE hurt_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Hurt assessment not found');
        }
    });
});

// 新增疼痛測量數據 (POST)
app.post('/hurt', (req, res) => {
    const { patient_id, patient_name, mode, pain, control } = req.body;
    if (!patient_id || !patient_name || !mode || !pain || control === undefined) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO hurt (patient_id, patient_name, mode, pain, control) VALUES (?, ?, ?, ?, ?)';
    connection.query(query, [patient_id, patient_name, mode, pain, control], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Hurt assessment saved successfully');
    });
});

// 更新疼痛測量數據 (PUT)
app.put('/hurt/:hurt_id', (req, res) => {
    const assessmentId = req.params.hurt_id;
    const { patient_id, patient_name, mode, pain, control } = req.body;

    const query = 'UPDATE hurt SET patient_id = ?, patient_name = ?, mode = ?, pain = ?, control = ? WHERE hurt_id = ?';
    connection.query(query, [patient_id, patient_name, mode, pain, control, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Hurt assessment updated successfully');
    });
});

// 刪除疼痛測量數據 (DELETE)
app.delete('/hurt/:hurt_id', (req, res) => {
    const assessmentId = req.params.hurt_id;

    const query = 'DELETE FROM hurt WHERE hurt_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Hurt assessment deleted successfully');
    });
});

// 獲取所有知識測試數據 (GET)
app.get('/knowledge', (req, res) => {
    const query = 'SELECT * FROM knowledge';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('knowledge', { assessments: results });
    });
});

// 獲取特定知識測試數據 (GET by ID)
app.get('/knowledge/:knowledge_id', (req, res) => {
    const assessmentId = req.params.knowledge_id;
    const query = 'SELECT * FROM knowledge WHERE knowledge_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Knowledge assessment not found');
        }
    });
});

// 新增知識測試數據 (POST)
app.post('/knowledge', (req, res) => {
    const { patient_id, test_date, score, follow_up_required } = req.body;
    if (!patient_id || !test_date || !score || follow_up_required === undefined) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO knowledge (patient_id, test_date, score, follow_up_required) VALUES (?, ?, ?, ?)';
    connection.query(query, [patient_id, test_date, score, follow_up_required], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Knowledge assessment saved successfully');
    });
});

// 更新知識測試數據 (PUT)
app.put('/knowledge/:knowledge_id', (req, res) => {
    const assessmentId = req.params.knowledge_id;
    const { patient_id, test_date, score, follow_up_required } = req.body;

    const query = 'UPDATE knowledge SET patient_id = ?, test_date = ?, score = ?, follow_up_required = ? WHERE knowledge_id = ?';
    connection.query(query, [patient_id, test_date, score, follow_up_required, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Knowledge assessment updated successfully');
    });
});

// 刪除知識測試數據 (DELETE)
app.delete('/knowledge/:knowledge_id', (req, res) => {
    const assessmentId = req.params.knowledge_id;

    const query = 'DELETE FROM knowledge WHERE knowledge_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Knowledge assessment deleted successfully');
    });
});

// 獲取所有睡眠測量數據 (GET)
app.get('/sleep', (req, res) => {
    const query = 'SELECT * FROM sleep';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('sleep', { assessments: results });
    });
});

// 獲取特定睡眠測量數據 (GET by ID)
app.get('/sleep/:sleep_id', (req, res) => {
    const assessmentId = req.params.sleep_id;
    const query = 'SELECT * FROM sleep WHERE sleep_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Sleep assessment not found');
        }
    });
});

app.post('/sleep', (req, res) => {
    const { patient_id, sleep_date, sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbance, sleep_medication, daytime_dysfunction, total_score, sleep_disorder } = req.body;

    console.log('Received data:', req.body); // 打印接收到的資料

    if (patient_id == null || !sleep_date || sleep_quality == null || sleep_latency == null || sleep_duration == null || sleep_efficiency == null || sleep_disturbance == null || sleep_medication == null || daytime_dysfunction == null || total_score == null || sleep_disorder == null) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO sleep (patient_id, sleep_date, sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbance, sleep_medication, daytime_dysfunction, total_score, sleep_disorder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(query, [patient_id, sleep_date, sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbance, sleep_medication, daytime_dysfunction, total_score, sleep_disorder], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Sleep assessment saved successfully');
    });
});



// 更新睡眠測量數據 (PUT)
app.put('/sleep/:sleep_id', (req, res) => {
    const assessmentId = req.params.sleep_id;
    const { patient_id, sleep_date, sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbance, sleep_medication, daytime_dysfunction, total_score, sleep_disorder } = req.body;

    const query = 'UPDATE sleep SET patient_id = ?, sleep_date = ?, sleep_quality = ?, sleep_latency = ?, sleep_duration = ?, sleep_efficiency = ?, sleep_disturbance = ?, sleep_medication = ?, daytime_dysfunction = ?, total_score = ?, sleep_disorder = ? WHERE sleep_id = ?';
    connection.query(query, [patient_id, sleep_date, sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbance, sleep_medication, daytime_dysfunction, total_score, sleep_disorder, assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Sleep assessment updated successfully');
    });
});

// 刪除睡眠測量數據 (DELETE)
app.delete('/sleep/:sleep_id', (req, res) => {
    const assessmentId = req.params.sleep_id;

    const query = 'DELETE FROM sleep WHERE sleep_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Sleep assessment deleted successfully');
    });
});

// 獲取所有分析結果資料
app.get('/analysis', (req, res) => {
    const query = 'SELECT * FROM analysis';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('analysis', { analysis: results }); // 渲染 analysis.ejs 模板
});
});
// 根據 analysis_id 獲取特定分析結果資料
app.get('/analysis/:analysis_id', (req, res) => {
    const analysisId = req.params.analysis_id;
    const query = 'SELECT * FROM analysis WHERE analysis_id = ?';
    connection.query(query, [analysisId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]); // 返回 JSON 數據
        } else {
            res.status(404).send('Analysis data not found');
        }
    });
});
// 新增分析結果資料
app.post('/analysis', (req, res) => {
    console.log('Request body:', req.body); // 檢查請求數據


    const { user_id, analysis_date, test_score, analysis_advice } = req.body;


    console.log('user_id:', user_id); // 檢查 user_id 值
    console.log('analysis_date:', analysis_date); // 檢查 analysis_date 值


    if (!user_id || !analysis_date) {
        return res.status(400).send('user_id and analysis_date cannot be null');
    }


    const query = `
        INSERT INTO analysis (user_id, analysis_date, test_score, analysis_advice)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            test_score = VALUES(test_score),
            analysis_advice = VALUES(analysis_advice);
    `;


    connection.query(query, [user_id, analysis_date, test_score, analysis_advice], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});
// 更新分析結果資料
app.put('/analysis/:analysis_id', (req, res) => {
    const analysisId = req.params.analysis_id;
    const { analysis_date, test_score, analysis_advice } = req.body;


    const query = `
        UPDATE analysis
        SET analysis_date = ?, test_score = ?, analysis_advice = ?
        WHERE analysis_id = ?
    `;


    connection.query(query, [analysis_date, test_score, analysis_advice, analysisId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});


// 刪除分析結果資料
app.delete('/analysis/:analysis_id', (req, res) => {
    const analysisId = req.params.analysis_id;
   
    const query = 'DELETE FROM analysis WHERE analysis_id = ?';
   
    connection.query(query, [analysisId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        console.log('Delete result:', result);
        res.send('Data deleted successfully');
    });
});
// 獲取所有進階查詢資料
app.get('/advanced_search', (req, res) => {
    const query = 'SELECT * FROM advanced_search';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('advanced_search', { advancedSearch: results }); // 渲染 advanced_search.ejs 模板
    });
});


// 根據 search_id 獲取特定進階查詢資料
app.get('/advanced_search/:search_id', (req, res) => {
    const searchId = req.params.search_id;
    const query = 'SELECT * FROM advanced_search WHERE search_id = ?';
    connection.query(query, [searchId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]); // 返回 JSON 數據
        } else {
            res.status(404).send('Advanced search data not found');
        }
    });
});


// 新增進階查詢資料
app.post('/advanced_search', (req, res) => {
    const { user_id, child_order, search_name, search_birthdate, search_blood_type } = req.body;


    if (!user_id || !child_order || !search_name || !search_birthdate || !search_blood_type) {
        return res.status(400).send('All fields are required and cannot be null');
    }


    const query = `
        INSERT INTO advanced_search (user_id, child_order, search_name, search_birthdate, search_blood_type)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            child_order = VALUES(child_order),
            search_name = VALUES(search_name),
            search_birthdate = VALUES(search_birthdate),
            search_blood_type = VALUES(search_blood_type);
    `;


    connection.query(query, [user_id, child_order, search_name, search_birthdate, search_blood_type], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});


// 更新進階查詢資料
app.put('/advanced_search/:search_id', (req, res) => {
    const searchId = req.params.search_id;
    const { search_id, child_order, search_name, search_birthdate, search_blood_type } = req.body;


    const query = `
        UPDATE advanced_search
        SET search_id = ?, child_order = ?, search_name = ?, search_birthdate = ?, search_blood_type = ?
        WHERE search_id = ?
    `;


    connection.query(query, [search_id, child_order, search_name, search_birthdate, search_blood_type, searchId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});


// 刪除進階查詢資料
app.delete('/advanced_search/:search_id', (req, res) => {
    const searchId = req.params.search_id;
   
    const query = 'DELETE FROM advanced_search WHERE search_id = ?';
   
    connection.query(query, [searchId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        console.log('Delete result:', result);
        res.send('Data deleted successfully');
    });
});
// 獲取所有活動日誌資料
app.get('/user_activity_logs', (req, res) => {
    const query = 'SELECT * FROM user_activity_logs';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.json(results);
    });
});


// 根據 log_id 獲取特定活動日誌資料
app.get('/user_activity_logs/:log_id', (req, res) => {
    const logId = req.params.log_id;
    const query = 'SELECT * FROM user_activity_logs WHERE log_id = ?';
    connection.query(query, [logId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Log entry not found');
        }
    });
});
// 新增活動日誌資料
app.post('/user_activity_logs', (req, res) => {
    const { user_id, action, ip_address, user_agent, details } = req.body;


    const query = `
        INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details)
        VALUES (?, ?, ?, ?, ?)
    `;


    connection.query(query, [user_id, action, ip_address, user_agent, details], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Insert result:', result);
        res.send('Log entry added successfully');
    });
});


// 更新活動日誌資料
app.put('/user_activity_logs/:log_id', (req, res) => {
    const logId = req.params.log_id;
    const { user_id, action, ip_address, user_agent, details } = req.body;


    const query = `
        UPDATE user_activity_logs
        SET user_id = ?, action = ?, ip_address = ?, user_agent = ?, details = ?
        WHERE log_id = ?
    `;


    connection.query(query, [user_id, action, ip_address, user_agent, details, logId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Log entry updated successfully');
    });
});


// 刪除活動日誌資料
app.delete('/user_activity_logs/:log_id', (req, res) => {
    const logId = req.params.log_id;


    const query = 'DELETE FROM user_activity_logs WHERE log_id = ?';


    connection.query(query, [logId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        console.log('Delete result:', result);
        res.send('Log entry deleted successfully');
    });
});


app.get('/settings', (req, res) => {
    const query = 'SELECT * FROM settings';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('settings', { settings: results });
    });
});


app.get('/settings/:setting_id', (req, res) => {
    const settingId = req.params.setting_id;
    const query = 'SELECT * FROM settings WHERE setting_id = ?';
    connection.query(query, [settingId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Setting not found');
        }
    });
});


app.post('/settings', (req, res) => {
    const { user_id, username, password } = req.body;
    if (!user_id || !username || !password) {
        return res.status(400).send('User ID, username, and password cannot be null');
    }


    const query = 'INSERT INTO settings (user_id, username, password) VALUES (?, ?, ?)';
    connection.query(query, [user_id, username, password], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Setting saved successfully');
    });
});




app.put('/settings/:setting_id', (req, res) => {
    const settingId = req.params.setting_id;
    const { user_id, username, password } = req.body;


    const query = 'UPDATE settings SET user_id = ?, username = ?, password = ? WHERE setting_id = ?';
    connection.query(query, [user_id, username, password, settingId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Setting updated successfully');
    });
});




app.delete('/settings/:setting_id', (req, res) => {
    const settingId = req.params.setting_id;


    const query = 'DELETE FROM settings WHERE setting_id = ?';
    connection.query(query, [settingId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Setting deleted successfully');
    });
});




app.get('/dashboard', (req, res) => {
    const query = 'SELECT * FROM dashboard';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('dashboard', { dashboard: results });
    });
});
app.get('/dashboard/:dashboard_id', (req, res) => {
    const permissionId = req.params.dashboard_id;
    const query = 'SELECT * FROM dashboard WHERE dashboard_id = ?';
    connection.query(query, [permissionId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Dashboard not found');
        }
    });
});


app.post('/dashboard', (req, res) => {
    const { user_id, employee_id, employee_name, role } = req.body;
    if (!user_id || !employee_id || !employee_name || !role) {
        return res.status(400).send('User ID, Employee ID, Employee Name, and Role cannot be null');
    }


    const query = 'INSERT INTO dashboard (user_id, employee_id, employee_name, role) VALUES (?, ?, ?, ?)';
    connection.query(query, [user_id, employee_id, employee_name, role], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        res.send('Permission saved successfully');
    });
});


app.put('/dashboard/:dashboard_id', (req, res) => {
    const permissionId = req.params.dashboard_id;
    const { user_id, employee_id, employee_name, role } = req.body;


    const query = 'UPDATE dashboard SET user_id = ?, employee_id = ?, employee_name = ?, role = ? WHERE dashboard_id = ?';
    connection.query(query, [user_id, employee_id, employee_name, role, permissionId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        res.send('Permission updated successfully');
    });
});


app.delete('/dashboard/:dashboard_id', (req, res) => {
    const permissionId = req.params.dashboard_id;


    const query = 'DELETE FROM dashboard WHERE dashboard_id = ?';
    connection.query(query, [permissionId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        res.send('Permission deleted successfully');
    });
});
       
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
