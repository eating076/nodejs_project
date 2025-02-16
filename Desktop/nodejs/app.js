const express = require('express');
const mysql = require('mysql');
const dayjs = require('dayjs');
const app = express();
const port = 3000;
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
    const userId = req.body.userId || null; 
    const action = req.method + ' ' + req.originalUrl;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const details = JSON.stringify(req.body);

    const query = `
        INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details) 
        VALUES (?, ?, ?, ?, ?)
    `;
    
    connection.query(query, [userId, action, ipAddress, userAgent, details], (err, result) => {
        if (err) {
            console.error('Error logging activity:', err);
        }
        next();
    });
});

app.get('/', (req, res) => { res.render('index'); });
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

app.get('/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT * FROM users WHERE id = ?';
    
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

app.post('/users', (req, res) => {
    const {
        name, email, age, address, phone, id_number, gender, birthdate, height, weight,
        blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;
    if (!name) {
        return res.status(400).send("Name cannot be null");
    }
    console.log('Received data:', {
        name, email, age, address, phone, id_number, gender, birthdate, height, weight,
        blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    });
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);
    const userAgent = req.headers['user-agent'];
    const checkQuery = 'SELECT id FROM users WHERE name = ?';
    connection.query(checkQuery, [name], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        const userId = results.length > 0 ? results[0].id : null;

        if (userId) {
            const updateQuery = `
                UPDATE users 
                SET email = ?, age = ?, address = ?, phone = ?, id_number = ?, gender = ?, birthdate = ?, 
                    height = ?, weight = ?, blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?, 
                    betel_nut_habit = ?, allergies = ?
                WHERE id = ?;
            `;
            connection.query(updateQuery, [
                email, age, address, phone, id_number, gender, birthdate, height, weight,
                blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies, userId
            ], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send(`Error updating data: ${err.message}`);
                    return;
                }
                console.log('Update result:', result);
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
                    res.send('Data updated successfully');
                });
            });
        } else {
            const insertQuery = `
                INSERT INTO users (name, email, age, address, phone, id_number, gender, birthdate, height,
                    weight, blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            connection.query(insertQuery, [
                name, email, age, address, phone, id_number, gender, birthdate, height, weight,
                blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
            ], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send(`Error saving data: ${err.message}`);
                    return;
                }
                console.log('Insert result:', result);

                const newUserId = result.insertId; 
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
                    res.send('Data saved successfully');
                });
            });
        }
    });
});
app.put('/users/:id', (req, res) => {
    const userId = req.params.id;
    const { name, email, age, address, phone, id_number, gender, birthdate, height, weight, blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies } = req.body;

    const checkQuery = 'SELECT id FROM users WHERE email = ? AND id != ?';
    connection.query(checkQuery, [email, userId], (err, results) => {
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
                SET name = ?, email = ?, age = ?, address = ?, phone = ?, id_number = ?, gender = ?, birthdate = ?, height = ?, weight = ?, blood_type = ?, emergency_contact_name = ?, emergency_contact_phone = ?, betel_nut_habit = ?, allergies = ?
                WHERE id = ?;
            `;
            connection.query(updateQuery, [name, email, age, address, phone, id_number, gender, birthdate, height, weight, blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies, userId], (err, result) => {
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
app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;
    const deleteQuery = 'DELETE FROM users WHERE id = ?';
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
app.get('/about', (req, res) => {
    res.render('about', {
        name: req.query.name,
        email: req.query.email,
        age: req.query.age,
        address: req.query.address,
        phone: req.query.phone,
        id_number: req.query.id_number,
        gender: req.query.gender,
        birthdate: req.query.birthdate,
        height: req.query.height,
        weight: req.query.weight,
        blood_type: req.query.blood_type,
        emergency_contact_name: req.query.emergency_contact_name,
        emergency_contact_phone: req.query.emergency_contact_phone,
        betel_nut_habit: req.query.betel_nut_habit,
        allergies: req.query.allergies
    });
});
app.post('/about', (req, res) => {
    const {
        name, email, age, address, phone, id_number, gender, birthdate, height, weight,
        blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    } = req.body;
    const query = `
        INSERT INTO users (name, email, age, address, phone, id_number, gender, birthdate, height, weight,
            blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(query, [
        name, email, age, address, phone, id_number, gender, birthdate, height, weight,
        blood_type, emergency_contact_name, emergency_contact_phone, betel_nut_habit, allergies
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Insert result:', result);
        res.redirect(`/about?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&age=${encodeURIComponent(age)}&address=${encodeURIComponent(address)}&phone=${encodeURIComponent(phone)}&id_number=${encodeURIComponent(id_number)}&gender=${encodeURIComponent(gender)}&birthdate=${encodeURIComponent(birthdate)}&height=${encodeURIComponent(height)}&weight=${encodeURIComponent(weight)}&blood_type=${encodeURIComponent(blood_type)}&emergency_contact_name=${encodeURIComponent(emergency_contact_name)}&emergency_contact_phone=${encodeURIComponent(emergency_contact_phone)}&betel_nut_habit=${encodeURIComponent(betel_nut_habit)}&allergies=${encodeURIComponent(allergies)}`);
    });
});
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
app.get('/steps/:id', (req, res) => {
    const stepId = req.params.id;
    const query = 'SELECT * FROM steps WHERE id = ?';
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
app.post('/steps', (req, res) => {
    const { date, steps, goal } = req.body;
    const completionRate = ((steps / goal) * 100).toFixed(2);
    const query = `
        INSERT INTO steps (date, steps, goal, completion_rate) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            steps = VALUES(steps), 
            goal = VALUES(goal), 
            completion_rate = VALUES(completion_rate);
    `;
    connection.query(query, [date, steps, goal, completionRate], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});
app.put('/steps/:id', (req, res) => {
    const stepId = req.params.id;
    const { date, steps, goal } = req.body;
    const completionRate = ((steps / goal) * 100).toFixed(2);
    const query = `
        UPDATE steps 
        SET date = ?, steps = ?, goal = ?, completion_rate = ?
        WHERE id = ?
    `;
    connection.query(query, [date, steps, goal, completionRate, stepId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});
app.delete('/steps/:id', (req, res) => {
    const stepId = req.params.id;
    const query = 'DELETE FROM steps WHERE id = ?';
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
        res.render('scores', { scores: results }); // 渲染 scores.ejs 模板
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
app.get('/analysis', (req, res) => {
    const query = 'SELECT * FROM analysis';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('analysis', { analysis: results });
    });
});
app.get('/analysis/:id', (req, res) => {
    const analysisId = req.params.id;
    const query = 'SELECT * FROM analysis WHERE id = ?';
    connection.query(query, [analysisId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Analysis data not found');
        }
    });
});
app.post('/analysis', (req, res) => {
    const { testDate, testScore, analysisAdvice } = req.body;
    const query = `
        INSERT INTO analysis (test_date, test_score, analysis_advice) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            test_score = VALUES(test_score), 
            analysis_advice = VALUES(analysis_advice);
    `;
    connection.query(query, [testDate, testScore, analysisAdvice], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});
app.put('/analysis/:id', (req, res) => {
    const analysisId = req.params.id;
    const { testDate, testScore, analysisAdvice } = req.body;
    const query = `
        UPDATE analysis 
        SET test_date = ?, test_score = ?, analysis_advice = ?
        WHERE id = ?
    `;
    connection.query(query, [testDate, testScore, analysisAdvice, analysisId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});
app.delete('/analysis/:id', (req, res) => {
    const analysisId = req.params.id;
    const query = 'DELETE FROM analysis WHERE id = ?';
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
app.get('/advanced-search', (req, res) => {
    const query = 'SELECT * FROM advanced_search';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        res.render('advanced-search', { searches: results });
    });
});
app.get('/advanced-search/:id', (req, res) => {
    const searchId = req.params.id;
    const query = 'SELECT * FROM advanced_search WHERE id = ?';
    connection.query(query, [searchId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error querying data: ${err.message}`);
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Advanced search data not found');
        }
    });
});
app.post('/advanced-search', (req, res) => {
    const { id, childOrder, name, birthdate, bloodType } = req.body;
    const query = `
        INSERT INTO advanced_search (id, child_order, name, birthdate, blood_type) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            child_order = VALUES(child_order), 
            name = VALUES(name), 
            birthdate = VALUES(birthdate), 
            blood_type = VALUES(bloodType);
    `;
    connection.query(query, [id, childOrder, name, birthdate, bloodType], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error saving data: ${err.message}`);
            return;
        }
        console.log('Query result:', result);
        res.send('Data saved successfully');
    });
});
app.put('/advanced-search/:id', (req, res) => {
    const searchId = req.params.id;
    const { id, childOrder, name, birthdate, bloodType } = req.body;
    const query = `
        UPDATE advanced_search 
        SET id = ?, child_order = ?, name = ?, birthdate = ?, blood_type = ?
        WHERE id = ?
    `;
    connection.query(query, [id, childOrder, name, birthdate, bloodType, searchId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }
        console.log('Update result:', result);
        res.send('Data updated successfully');
    });
});
app.delete('/advanced-search/:id', (req, res) => {
    const searchId = req.params.id;
    const query = 'DELETE FROM advanced_search WHERE id = ?';
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
app.get('/user_activity_logs/:id', (req, res) => {
    const logId = req.params.id;
    const query = 'SELECT * FROM user_activity_logs WHERE id = ?';
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
app.put('/user_activity_logs/:id', (req, res) => {
    const logId = req.params.id;
    const { user_id, action, ip_address, user_agent, details } = req.body;
    const query = `
        UPDATE user_activity_logs 
        SET user_id = ?, action = ?, ip_address = ?, user_agent = ?, details = ?
        WHERE id = ?
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
app.delete('/user_activity_logs/:id', (req, res) => {
    const logId = req.params.id;
    const query = 'DELETE FROM user_activity_logs WHERE id = ?';
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
    console.log(`Server is running on http://localhost:${port}`);
});
