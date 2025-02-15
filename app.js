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

app.use((req, res, next) => { 
    const userId = req.body.userId || null; const action = req.method + ' ' + req.originalUrl;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const details = JSON.stringify(req.body);
    const query = ` INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?) `;
    
    connection.query(query, [userId, action, ipAddress, userAgent, details], (err, result) => { if (err) {
         console.error('Error logging activity:', err);
         }
    next();
 });
 });


app.get('/', (req, res) => { res.render('index'); });
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
// 新增用戶
app.post('/users', (req, res) => {
    const {
        user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    // 驗證必需字段是否存在
    if (!user_name) {
        return res.status(400).send("Name cannot be null");
    }

    console.log('Received data:', {
        user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
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
                SET user_email = ?, user_age = ?, user_address = ?, user_phone = ?, user_id_number = ?, user_gender = ?, user_birthdate = ?, 
                    user_height = ?, user_weight = ?, user_blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?, 
                    betel_nut_habit = ?, allergies = ?
                WHERE user_id = ?;
            `;
            connection.query(updateQuery, [
                user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
                user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies, userId
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
                    
                    res.redirect(`/about?user_id=${userId}`);
                });
            });
        } else {
            // 新增新記錄
            const insertQuery = `
                INSERT INTO users (user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height,
                    user_weight, user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            connection.query(insertQuery, [
                user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
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
                    res.redirect(`/about?user_id=${newUserId}`);
                });
            });
        }
    });
});
// 更新用戶資料
app.put('/users/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight, user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies } = req.body;

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
                SET user_name = ?, user_email = ?, user_age = ?, user_address = ?, user_phone = ?, user_id_number = ?, user_gender = ?, user_birthdate = ?, user_height = ?, user_weight = ?, user_blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?, betel_nut_habit = ?, allergies = ?
                WHERE user_id = ?;
            `;
            connection.query(updateQuery, [user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight, user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies, userId], (err, result) => {
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
// about 頁面 GET 請求
app.get('/about', (req, res) => {
    res.render('about', {
        user_name: req.query.user_name,
        user_email: req.query.user_email,
        user_age: req.query.user_age,
        user_address: req.query.user_address,
        user_phone: req.query.user_phone,
        user_id_number: req.query.user_id_number,
        user_gender: req.query.user_gender,
        user_birthdate: req.query.user_birthdate,
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
app.post('/about', (req, res) => {
    const {
        user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;

    const query = `
        INSERT INTO users (user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
            user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [
        user_name, user_email, user_age, user_address, user_phone, user_id_number, user_gender, user_birthdate, user_height, user_weight,
        user_blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }

        console.log('Insert result:', result);

        res.redirect(`/about?user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_age=${encodeURIComponent(user_age)}&user_address=${encodeURIComponent(user_address)}&user_phone=${encodeURIComponent(user_phone)}&user_id_number=${encodeURIComponent(user_id_number)}&user_gender=${encodeURIComponent(user_gender)}&user_birthdate=${encodeURIComponent(user_birthdate)}&user_height=${encodeURIComponent(user_height)}&user_weight=${encodeURIComponent(user_weight)}&user_blood_type=${encodeURIComponent(user_blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
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
// 獲取所有測驗分數資料
app.get('/scores', (req, res) => {
    const query = 'SELECT * FROM scores';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.json(results); // 返回 JSON 數據
    });
});

// 根據 score_id 獲取特定測驗分數資料
app.get('/scores/:score_id', (req, res) => {
    const scoreId = req.params.score_id;
    const query = 'SELECT * FROM scores WHERE score_id = ?';
    connection.query(query, [scoreId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]); // 返回 JSON 數據
        } else {
            res.status(404).send('Score data not found');
        }
    });
});
// 新增測驗分數資料
app.post('/scores', (req, res) => {
    console.log('Request body:', req.body); // 檢查請求數據

    const { user_id, test_date, stress_index, weight_change, depression_index, test_score } = req.body;

    console.log('user_id:', user_id);
    console.log('test_date:', test_date);
    console.log('stress_index:', stress_index);
    console.log('weight_change:', weight_change);
    console.log('depression_index:', depression_index);
    console.log('test_score:', test_score);

    if (!user_id || !test_date) {
        console.log('Validation failed');
        return res.status(400).send('user_id and test_date cannot be null');
    }

    const query = `
        INSERT INTO scores (user_id, test_date, stress_index, weight_change, depression_index, test_score) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            stress_index = VALUES(stress_index), 
            weight_change = VALUES(weight_change), 
            depression_index = VALUES(depression_index),
            test_score = VALUES(test_score);
    `;

    connection.query(query, [user_id, test_date, stress_index, weight_change, depression_index, test_score], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error saving data: ${err.message}`);
        } else {
            console.log('Query result:', result);
            res.send('Data saved successfully');
        }
    });
});
// 更新測驗分數資料
app.put('/scores/:score_id', (req, res) => {
    const scoreId = req.params.score_id;
    const { test_date, stress_index, weight_change, depression_index, test_score } = req.body;

    const query = `
        UPDATE scores 
        SET test_date = ?, stress_index = ?, weight_change = ?, depression_index = ?, test_score = ?
        WHERE score_id = ?
    `;

    connection.query(query, [test_date, stress_index, weight_change, depression_index, test_score, scoreId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});

// 刪除測驗分數資料
app.delete('/scores/:score_id', (req, res) => {
    const scoreId = req.params.score_id;
    
    const query = 'DELETE FROM scores WHERE score_id = ?';
    
    connection.query(query, [scoreId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error deleting data: ${err.message}`);
            return;
        }
        console.log('Delete result:', result);
        res.send('Data deleted successfully');
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
        res.json(results); // 返回 JSON 數據
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
app.get('/advanced-search', (req, res) => {
    const query = 'SELECT * FROM advanced_search';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.json(results); // 返回 JSON 數據
    });
});

// 根據 search_id 獲取特定進階查詢資料
app.get('/advanced-search/:search_id', (req, res) => {
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
app.post('/advanced-search', (req, res) => {
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
app.put('/advanced-search/:search_id', (req, res) => {
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
app.delete('/advanced-search/:search_id', (req, res) => {
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


app.get('/settings', (req, res) => 
    { res.render('settings'); 
    }); 
app.get('/add1', (req, res) => 
    { res.render('add1', { type: 'admin', action: '/add1' 

    }); 
}); 
app.post('/add1', (req, res) => 
    { const { employeeId, employeeName } = req.body; const query = 'INSERT INTO admins (employee_id, employee_name) VALUES (?, ?)'; connection.query(query, [employeeId, employeeName], (err, result) => 
        { if (err) { console.error('Error executing query:', err); res.status(500).send(`Error saving data: ${err.message}`); return; } console.log('Insert result:', result); res.redirect('/settings'); 
}); 
}); 
app.get('/edit1', (req, res) => 
    { res.render('edit1', { type: 'admin', action: '/edit1' 
    }); 
}); 
app.post('/edit1', (req, res) => 
    { const { employeeId, employeeName } = req.body; const query = 'UPDATE admins SET employee_name = ? WHERE employee_id = ?'; connection.query(query, [employeeName, employeeId], (err, result) => 
        { if (err) { console.error('Error executing query:', err); res.status(500).send(`Error updating data: ${err.message}`); return; } console.log('Update result:', result); res.redirect('/settings'); 
}); 
}); 
app.get('/delete1', (req, res) => 
    { res.render('delete1', { type: 'admin', action: '/delete1' 
    }); 
}); 
app.post('/delete1', (req, res) => 
    { const { employeeId } = req.body; const query = 'DELETE FROM admins WHERE employee_id = ?'; connection.query(query, [employeeId], (err, result) => { if (err) { console.error('Error executing query:', err); res.status(500).send(`Error deleting data: ${err.message}`); return; } console.log('Delete result:', result); res.redirect('/settings'); 
}); 
}); 
app.get('/add2', (req, res) => 
    { res.render('add2', { type: 'item', action: '/add2' 

    }); 
}); 
app.post('/add2', (req, res) => 
    { const { itemName, itemContent } = req.body; const query = 'INSERT INTO items (item_name, item_content) VALUES (?, ?)'; connection.query(query, [itemName, itemContent], (err, result) => { if (err) { console.error('Error executing query:', err); res.status(500).send(`Error saving data: ${err.message}`); return; } console.log('Insert result:', result); res.redirect('/settings'); 
}); 
}); 
app.get('/edit2', (req, res) => 
    { res.render('edit2', { type: 'item', action: '/edit2' 

    }); 
}); 
app.post('/edit2', (req, res) => 
    { const { itemId, itemName, itemContent } = req.body; 
const query = 'UPDATE items SET item_name = ?, item_content = ? WHERE item_id = ?'; 
connection.query(query, [itemName, itemContent, itemId], (err, result) => 
        {if (err) { console.error('Error executing query:', err); 
            res.status(500).send(`Error updating data: ${err.message}`); 
            return; 
        } 
            console.log('Update result:', result); 
            res.redirect('/settings'); 
}); 
}); 
app.get('/delete2', (req, res) => 
    { res.render('delete2', { type: 'item', action: '/delete2' 

    }); 
}); 
app.post('/delete2', (req, res) => 
    { const { itemId } = req.body; 
      const query = 'DELETE FROM items WHERE item_id = ?'; 
      connection.query(query, [itemId], (err, result) => {
        if (err) { console.error('Error executing query:', err);
             res.status(500).send(`Error deleting data: ${err.message}`);
              return; } console.log('Delete result:', result);
               res.redirect('/settings'); 
            }); 
        });
        
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
