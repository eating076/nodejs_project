const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const dayjs = require('dayjs');
const app = express();
const port = process.env.PORT || 3000;
const ExcelJS = require('exceljs');
const session = require('express-session');

app.use(session({
    secret: 'alalsoso', // 替換為安全的隨機字串
    resave: false,
    saveUninitialized: false
}));

app.use(cors());
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

function authenticateRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.session.userRole;

        if (!userRole) {
            return res.status(403).send('未登入，請先登入！');
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).send('您沒有權限執行此操作！');
        }

        next();
    };
}

app.use((req, res, next) => {
    console.log(`有新訪客 : 來自 ${req.hostname} | 請求頁面 ${req.path}`);
    next();
});

// 新增 logActivity 函數
function logActivity(userId, manUserId, action, ipAddress, userAgent, details) {
    if (!userId) {
        console.warn('User ID is null, activity not logged:', { action, ipAddress, userAgent, details });
        return;
    }

    const logQuery = `
        INSERT INTO user_activity_logs (user_id, man_user_id, action, ip_address, user_agent, details)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    connection.query(logQuery, [userId, manUserId, action, ipAddress, userAgent, details], (err, result) => {
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
    const manUserId = req.body.manUserId || null;  // 新增管理使用者 ID
    const action = req.method + ' ' + req.originalUrl;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const details = JSON.stringify(req.body);

    // 僅在 userId 存在時記錄活動日誌
    logActivity(userId, manUserId, action, ipAddress, userAgent, details);
    next();
});


app.get('/', (req, res) => {
    res.redirect('/settings'); // 訪問根路徑時，重定向到 settings
});

app.get('/settings', (req, res) => {
    const userRole = req.session.userRole || null; // 確保有值
    res.render('settings', { userRole });
});

app.post('/setUserSession', (req, res) => {
    req.session.user_id = req.body.user_id; // 🚀 存入 Session
    res.redirect('/result'); // 轉跳到 result.ejs
});

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
    const { name, gender, birthdate, salutation } = req.query; // 接收查詢參數
    let query = 'SELECT * FROM users WHERE 1=1'; // 使用 1=1 確保基礎查詢有效
    const params = [];

    if (name) {
        query += ' AND user_name LIKE ?';
        params.push(`%${name}%`);
    }
    if (gender) {
        query += ' AND user_gender = ?';
        params.push(gender);
    }
    if (birthdate) {
        query += ' AND user_birthdate = ?';
        params.push(birthdate);
    }
    if (salutation) {
        query += ' AND user_salutation = ?';
        params.push(salutation);
    }

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error fetching data: ${err.message}`);
        }
        res.json(results); // 返回符合條件的數據
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
    user_id, // 若有，代表是更新，否則是新增
    user_name, user_birthdate, user_height, current_weight, pre_pregnancy_weight, user_gender,
    user_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    emergency_contact_name2, emergency_contact_relation2, emergency_contact_phone2, pairing_code,
    betel_nut_habit, smoking_habit, drinking_habit, contact_preference, chronic_illness,
    chronic_illness_details, marital_status, user_salutation, user_account, user_password
  } = req.body;

  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const logData = JSON.stringify(req.body);

  if (user_id) {
    // 更新資料
    const fields = {
      user_name, user_birthdate, user_height, current_weight, pre_pregnancy_weight, user_gender,
      user_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      emergency_contact_name2, emergency_contact_relation2, emergency_contact_phone2, pairing_code,
      betel_nut_habit, smoking_habit, drinking_habit, contact_preference, chronic_illness,
      chronic_illness_details, marital_status, user_salutation, user_password
    };

    const keys = Object.keys(fields).filter(key => fields[key] !== undefined && fields[key] !== null);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]).concat(user_id);
    const sql = `UPDATE users SET ${setClause} WHERE user_id = ?`;

    connection.query(sql, values, (err, result) => {
      if (err) return res.status(500).send(`Error updating data: ${err.message}`);

      const logQuery = `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)`;
      connection.query(logQuery, [user_id, 'User updated', ipAddress, userAgent, logData]);

      res.status(200).json({ message: '✅ 使用者更新成功' });
    });

  } else {
    // 新增使用者資料
    if (!user_name || !user_account || !user_password) {
      return res.status(400).send("Name, Account, and Password cannot be null");
    }

    const insertQuery = `
      INSERT INTO users (
        user_name, user_birthdate, user_height, current_weight, pre_pregnancy_weight, user_gender,
        user_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        emergency_contact_name2, emergency_contact_relation2, emergency_contact_phone2, pairing_code,
        betel_nut_habit, smoking_habit, drinking_habit, contact_preference, chronic_illness,
        chronic_illness_details, marital_status, user_salutation, user_account, user_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertValues = [
      user_name, user_birthdate, user_height, current_weight, pre_pregnancy_weight, user_gender,
      user_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      emergency_contact_name2, emergency_contact_relation2, emergency_contact_phone2, pairing_code,
      betel_nut_habit, smoking_habit, drinking_habit, contact_preference, chronic_illness,
      chronic_illness_details, marital_status, user_salutation, user_account, user_password
    ];

    connection.query(insertQuery, insertValues, function(err, result) {
      if (err) return res.status(500).send(`Error inserting data: ${err.message}`);
      if (!result || !result.insertId) return res.status(500).send('新增使用者失敗，無 insertId');

      const newUserId = result.insertId;
      const logQuery = `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)`;
      connection.query(logQuery, [newUserId, 'User created', ipAddress, userAgent, logData]);

      res.status(201).json({ message: '✅ 使用者新增成功', user_id: newUserId });
    });
  }
});




// 更新用戶資料
app.put('/users/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { 
        user_name, user_gender, user_salutation, user_birthdate, 
        user_height, current_weight, pre_pregnancy_weight, user_phone,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        emergency_contact_name2, emergency_contact_relation2, emergency_contact_phone2,
        pairing_code, betel_nut_habit, smoking_habit, drinking_habit, contact_preference, 
        chronic_illness, chronic_illness_details, marital_status 
    } = req.body;

    // 更新資料
    const updateQuery = `
        UPDATE users
        SET user_name = ?, user_gender = ?, user_salutation = ?, 
            user_birthdate = ?, user_height = ?, current_weight = ?, 
            pre_pregnancy_weight = ?, user_phone = ?, emergency_contact_name = ?, emergency_contact_phone = ?, 
            emergency_contact_relation = ?, emergency_contact_name2 = ?, emergency_contact_relation2 = ?, 
            emergency_contact_phone2 = ?, pairing_code = ?, betel_nut_habit = ?, smoking_habit = ?, 
            drinking_habit = ?, contact_preference = ?, chronic_illness = ?, chronic_illness_details = ?, 
            marital_status = ?
        WHERE user_id = ?;
    `;
    
    connection.query(updateQuery, [
        user_name, user_gender, user_salutation, user_birthdate, 
        user_height, current_weight, pre_pregnancy_weight, user_phone, emergency_contact_name, 
        emergency_contact_phone, emergency_contact_relation, emergency_contact_name2, 
        emergency_contact_relation2, emergency_contact_phone2, pairing_code, betel_nut_habit, 
        smoking_habit, drinking_habit, contact_preference, chronic_illness, 
        chronic_illness_details, marital_status, userId
    ], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send(`Error updating data: ${err.message}`);
            return;
        }

        console.log('Update result:', result);
        res.send('✅ 使用者更新成功');
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

// **獲取所有男性使用者數據 (GET)**
app.get('/man_users', (req, res) => {
    const query = 'SELECT * FROM man_users ORDER BY man_user_birthdate ASC;';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).json({ error: `資料庫查詢失敗: ${err.message}` });
        }

        res.json(results);
    });
});

// **獲取特定男性使用者數據 (GET by ID)**
app.get('/man_users/:man_user_id', (req, res) => {
    const userId = req.params.man_user_id;
    const query = 'SELECT * FROM man_users WHERE man_user_id = ?;';

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).json({ error: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: '未找到該使用者數據' });
        }

        res.json(results[0]);
    });
});

app.post('/man_users', (req, res) => {
  const {
    man_user_id,
    man_user_name, man_user_birthdate, man_user_height, man_current_weight,
    man_user_gender, man_user_phone, man_emergency_contact_name,
    man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
    man_drinking_habit, man_contact_preference, man_chronic_illness,
    man_chronic_illness_details, man_marital_status, man_user_salutation,
    man_user_account, man_user_password,

    // 新增欄位
    man_emergency_contact_relation, man_emergency_contact_name2,
    man_emergency_contact_relation2, man_emergency_contact_phone2,
    man_pairing_code
  } = req.body;

  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const logData = JSON.stringify(req.body);

  // 🔄 如果有 ID 且為有效數字，就執行更新
  if (man_user_id && Number.isInteger(Number(man_user_id))) {
    const fields = {
      man_user_name, man_user_birthdate, man_user_height, man_current_weight,
      man_user_gender, man_user_phone, man_emergency_contact_name,
      man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
      man_drinking_habit,
      man_contact_preference: Array.isArray(man_contact_preference) ? man_contact_preference.join(',') : man_contact_preference,
      man_chronic_illness: Array.isArray(man_chronic_illness) ? man_chronic_illness.join(',') : man_chronic_illness,
      man_chronic_illness_details, man_marital_status, man_user_salutation,
      man_user_account, man_user_password,

      // 新增欄位
      man_emergency_contact_relation, man_emergency_contact_name2,
      man_emergency_contact_relation2, man_emergency_contact_phone2,
      man_pairing_code
    };

    const keys = Object.keys(fields).filter(key => fields[key] !== undefined && fields[key] !== null);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]).concat(man_user_id);
    const sql = `UPDATE man_users SET ${setClause} WHERE man_user_id = ?`;

    connection.query(sql, values, (err, result) => {
      if (err) return res.status(500).send(`Error updating data: ${err.message}`);

      const logQuery = `INSERT INTO user_activity_logs (man_user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)`;
      connection.query(logQuery, [man_user_id, 'Man user updated', ipAddress, userAgent, logData]);

      res.status(200).json({ message: '✅ 使用者更新成功 (man_users)' });
    });

  } else {
    // ✅ 沒有 ID 就執行新增
    if (!man_user_name || !man_user_account || !man_user_password) {
      return res.status(400).json({ error: 'Missing required fields: man_user_name, man_user_account, man_user_password' });
    }

    const insertQuery = `
      INSERT INTO man_users (
        man_user_name, man_user_birthdate, man_user_height, man_current_weight,
        man_user_gender, man_user_phone, man_emergency_contact_name,
        man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
        man_drinking_habit,
        man_contact_preference, man_chronic_illness,
        man_chronic_illness_details, man_marital_status, man_user_salutation,
        man_user_account, man_user_password,

        -- 新增欄位
        man_emergency_contact_relation, man_emergency_contact_name2,
        man_emergency_contact_relation2, man_emergency_contact_phone2,
        man_pairing_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      man_user_name, man_user_birthdate, man_user_height, man_current_weight,
      man_user_gender, man_user_phone, man_emergency_contact_name,
      man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
      man_drinking_habit,
      Array.isArray(man_contact_preference) ? man_contact_preference.join(',') : man_contact_preference,
      Array.isArray(man_chronic_illness) ? man_chronic_illness.join(',') : man_chronic_illness,
      man_chronic_illness_details, man_marital_status, man_user_salutation,
      man_user_account, man_user_password,

      // 新增欄位
      man_emergency_contact_relation, man_emergency_contact_name2,
      man_emergency_contact_relation2, man_emergency_contact_phone2,
      man_pairing_code
    ];

    connection.query(insertQuery, values, function(err, result) {
      if (err) return res.status(500).send(`Error inserting data: ${err.message}`);
      if (!result || !result.insertId) return res.status(500).send('新增失敗，無 insertId');

      const newUserId = result.insertId;
      console.log('✅ Debug: newUserId =', newUserId);

      const logQuery = `INSERT INTO user_activity_logs (man_user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)`;
      connection.query(logQuery, [newUserId, 'Man user created', ipAddress, userAgent, logData], function(logErr) {
        if (logErr) console.error(`Error logging activity: ${logErr.message}`);
      });

      res.status(201).json({ message: '✅ 使用者新增成功 (man_users)', man_user_id: newUserId });
    });
  }
});


app.put('/man_users/:man_user_id', (req, res) => {
  const { man_user_id } = req.params;

  const {
    man_user_name, man_user_birthdate, man_user_height, man_current_weight,
    man_user_gender, man_user_phone, man_emergency_contact_name,
    man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
    man_drinking_habit, man_contact_preference, man_chronic_illness,
    man_chronic_illness_details, man_marital_status, man_user_salutation,
    man_user_account, man_user_password,

    // 新增欄位
    man_emergency_contact_relation, man_emergency_contact_name2,
    man_emergency_contact_relation2, man_emergency_contact_phone2,
    man_pairing_code
  } = req.body;

  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const logData = JSON.stringify(req.body);

  const fields = {
    man_user_name, man_user_birthdate, man_user_height, man_current_weight,
    man_user_gender, man_user_phone, man_emergency_contact_name,
    man_emergency_contact_phone, man_betel_nut_habit, man_smoking_habit,
    man_drinking_habit, man_contact_preference, man_chronic_illness,
    man_chronic_illness_details, man_marital_status, man_user_salutation,
    man_user_account, man_user_password,

    // 新增欄位
    man_emergency_contact_relation, man_emergency_contact_name2,
    man_emergency_contact_relation2, man_emergency_contact_phone2,
    man_pairing_code
  };

  const keys = Object.keys(fields).filter(key => fields[key] !== undefined && fields[key] !== null);
  if (keys.length === 0) {
    return res.status(400).json({ error: '沒有要更新的欄位' });
  }

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]).concat(man_user_id);
  const sql = `UPDATE man_users SET ${setClause} WHERE man_user_id = ?`;

  connection.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(`❌ 更新失敗: ${err.message}`);
    if (result.affectedRows === 0) return res.status(404).json({ error: '使用者不存在' });

    const logQuery = `INSERT INTO user_activity_logs (man_user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)`;
    connection.query(logQuery, [man_user_id, 'Man user updated', ipAddress, userAgent, logData]);

    res.status(200).json({ message: '✅ 使用者更新成功 (man_users)' });
  });
});



app.delete('/man_users/:user_id', (req, res) => {
    const userId = req.params.user_id;

    const query = 'DELETE FROM man_users WHERE user_id = ?';
    connection.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'User deleted successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

app.get('/baby', (req, res) => {
    // **儲存初始查詢 ID**
    req.session.initialUserId = req.query.user_id || null;
    req.session.initialManUserId = req.query.man_user_id || null;

    const userId = req.query.user_id || req.body.user_id;
    const manUserId = req.query.man_user_id || req.body.man_user_id;
    const userRole = req.session.userRole || null;

    if (!userId && !manUserId) {
        return res.redirect('/index');
    }

    const query = `
        SELECT b.*, 
               u.user_name AS user_name, 
               m.man_user_name AS man_user_name 
        FROM baby b
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN man_users m ON b.man_user_id = m.man_user_id
        WHERE (b.user_id = ? OR b.man_user_id IN (SELECT man_user_id FROM baby WHERE user_id = ?))
           OR (b.man_user_id = ? OR b.user_id IN (SELECT user_id FROM baby WHERE man_user_id = ?));
    `;

    connection.query(query, [userId, userId, manUserId, manUserId], (err, results) => {
        if (err) {
            console.error("❌ SQL 查詢錯誤:", err);
            return res.status(500).json({ error: "資料庫查詢失敗，請稍後重試！" });
        }

        if (results.length === 0) {
            return res.redirect('/index');
        }

        res.render("baby", {
            babiesData: results,
            userId,
            manUserId,
            initialUserId: req.session.initialUserId, 
            initialManUserId: req.session.initialManUserId, 
            userRole,
            user_name: results[0]?.user_name || '未提供',
            man_user_name: results[0]?.man_user_name || '未提供',
            table: userId ? "users" : "man_users"
        });
    });
});



app.get('/baby/:baby_id', (req, res) => {
    const babyId = req.params.baby_id;
    const query = 'SELECT * FROM baby WHERE baby_id = ?';
    connection.query(query, [babyId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error querying data: ${err.message}` });
            return;
        }
        if (results.length > 0) {
            res.json(results[0]); // 返回特定寶寶數據
        } else {
            res.status(404).json({ error: 'Baby not found' });
        }
    });
});

app.post('/baby', (req, res) => {
    const {
        man_user_id, user_id, baby_name, baby_birthdate,
        baby_gender, baby_weight, baby_height,
        baby_solution, baby_solution_details
    } = req.body;

    if (!baby_name) {
        return res.status(400).json({ error: 'Missing required field: baby_name' });
    }

    if (!man_user_id && !user_id) {
        return res.status(400).json({ error: 'Missing required field: man_user_id or user_id' });
    }

    if (baby_solution === '有' && !baby_solution_details) {
        return res.status(400).json({ error: 'Missing required field: baby_solution_details for "有"' });
    }

    const query = `
        INSERT INTO baby (
            man_user_id, user_id, baby_name, baby_birthdate,
            baby_gender, baby_weight, baby_height,
            baby_solution, baby_solution_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        man_user_id || null, user_id || null, baby_name, baby_birthdate,
        baby_gender, baby_weight, baby_height, baby_solution, baby_solution_details || null
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error saving data: ${err.message}` });
            return;
        }
        res.status(201).json({ message: 'Baby added successfully', insertId: result.insertId });
    });
});
app.post('/baby/edit', (req, res) => {
    let { baby_id, baby_name, baby_birthdate, baby_gender, baby_weight, baby_height, baby_solution, baby_solution_details, user_id, man_user_id } = req.body;

    // **使用 session 存儲的初始查詢 ID**
    const initialUserId = req.session.initialUserId;
    const initialManUserId = req.session.initialManUserId;

    if (!baby_id || (!user_id && !man_user_id)) {
        return res.status(400).render('message', {
            title: "錯誤",
            message: "❌ 缺少 baby_id 或使用者 ID，請稍後重試！",
            buttonText: "返回嬰兒資料",
            returnUrl: `/baby?${initialManUserId ? "man_user_id=" + encodeURIComponent(initialManUserId) : "user_id=" + encodeURIComponent(initialUserId)}`,
        });
    }

    const selectQuery = `SELECT * FROM baby WHERE baby_id = ?`;
    connection.query(selectQuery, [baby_id], (err, results) => {
        if (err || results.length === 0) {
            console.error('❌ 查詢嬰兒資料失敗:', err);
            return res.status(500).render('message', {
                title: "錯誤",
                message: "❌ 修改失敗，請稍後重試！",
                buttonText: "返回嬰兒資料",
                returnUrl: `/baby?${initialManUserId ? "man_user_id=" + encodeURIComponent(initialManUserId) : "user_id=" + encodeURIComponent(initialUserId)}`,
            });
        }

        const existingData = results[0];
        const updatedData = {
            baby_name: baby_name || existingData.baby_name,
            baby_birthdate: baby_birthdate?.trim() === '' ? existingData.baby_birthdate : baby_birthdate,
            baby_gender: baby_gender || existingData.baby_gender,
            baby_weight: baby_weight || existingData.baby_weight,
            baby_height: baby_height || existingData.baby_height,
            baby_solution: baby_solution || existingData.baby_solution,
            baby_solution_details: baby_solution_details || existingData.baby_solution_details,
        };

        const updateQuery = `
            UPDATE baby SET 
            baby_name = ?, baby_birthdate = ?, baby_gender = ?, 
            baby_weight = ?, baby_height = ?, baby_solution = ?, baby_solution_details = ?
            WHERE baby_id = ?
        `;

        connection.query(updateQuery, [
            updatedData.baby_name, updatedData.baby_birthdate, updatedData.baby_gender,
            updatedData.baby_weight, updatedData.baby_height, updatedData.baby_solution, updatedData.baby_solution_details,
            baby_id
        ], (updateErr) => {
            if (updateErr) {
                console.error('❌ 更新嬰兒資料失敗:', updateErr);
                return res.status(500).render('message', {
                    title: "錯誤",
                    message: "❌ 修改失敗，請稍後重試！",
                    buttonText: "返回嬰兒資料",
                    returnUrl: `/baby?${initialManUserId ? "man_user_id=" + encodeURIComponent(initialManUserId) : "user_id=" + encodeURIComponent(initialUserId)}`,
                });
            }

            console.log("✅ 嬰兒資料成功更新，即將渲染 message.ejs");

            res.render('message', {
                title: "成功",
                message: "✅ 嬰兒資料更新完成！",
                buttonText: "返回嬰兒資料",
                returnUrl: `/baby?${initialManUserId ? "man_user_id=" + encodeURIComponent(initialManUserId) : "user_id=" + encodeURIComponent(initialUserId)}`,
            });
        });
    });
});



app.put('/baby/:baby_id', (req, res) => {
    const babyId = req.params.baby_id;
    const {
        man_user_id, user_id, baby_name, baby_birthdate,
        baby_gender, baby_weight, baby_height,
        baby_solution, baby_solution_details
    } = req.body;

    if (baby_solution === '有' && !baby_solution_details) {
        return res.status(400).json({ error: 'Missing required field: baby_solution_details for "有"' });
    }

    const query = `
        UPDATE baby SET
            man_user_id = ?, user_id = ?, baby_name = ?, baby_birthdate = ?,
            baby_gender = ?, baby_weight = ?, baby_height = ?,
            baby_solution = ?, baby_solution_details = ?
        WHERE baby_id = ?
    `;

    const values = [
        man_user_id, user_id, baby_name, baby_birthdate,
        baby_gender, baby_weight, baby_height,
        baby_solution, baby_solution_details || null, babyId
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error updating data: ${err.message}` });
            return;
        }
        res.json({ message: 'Baby updated successfully' });
    });
});

app.delete('/baby/:baby_id', (req, res) => {
    const babyId = req.params.baby_id;

    const query = 'DELETE FROM baby WHERE baby_id = ?';
    connection.query(query, [babyId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'Baby deleted successfully' });
        } else {
            res.status(404).json({ error: 'Baby not found' });
        }
    });
});

// 取得所有問題 (GET)
app.get('/user_question', (req, res) => {
    console.log("🔍 伺服器收到的 URL:", req.url);
    console.log("🔍 req.query:", req.query);
    console.log("🔍 req.body:", req.body);
    console.log("🔍 req.params:", req.params);

    let userId = req.query.user_id || req.body.user_id;
    console.log("🔍 解析出的 user_id:", userId);

    if (!userId || isNaN(userId)) {
        console.log("⚠️ user_id 未獲取或格式錯誤");
        return res.render('error', { message: '⚠️ 使用者 ID 未提供或格式錯誤' });
    }

    userId = parseInt(userId, 10);

    // 🔹 查詢 `user_name` 及 `user_question` 資料
    const query = `
        SELECT u.user_name, q.* 
        FROM user_question q 
        JOIN users u ON q.user_id = u.user_id
        WHERE q.user_id = ?
        ORDER BY q.question_id ASC;
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        console.log("✅ 渲染 user_question.ejs，傳遞資料:", results[0]);

        res.render("user_question", {
            userId,
            user_name: results[0].user_name, // ✅ 傳遞 `user_name`
            questionsData: results
        });
    });
});




// 根據 ID 取得單一問題 (GET:id)
app.get('/user_question/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM user_question WHERE question_id = ?;';

    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(404).render('error', { message: '未找到該問題' });
        }

        // 渲染 EJS 頁面，顯示該問題內容
        res.render('user_question_detail', { question: results[0] });
    });
});

app.post('/user_question', (req, res) => {
    // 解構從請求中接收到的欄位
    const { 
        user_id, 
        pregnancy_babies_count, 
        pregnancy_complications, 
        willing_to_breastfeed, 
        pregnancy_count, 
        delivery_count, 
        first_time_breastfeeding, 
        expected_breastfeeding_months, 
        first_time_delivery, 
        previous_breastfeeding_duration_months, 
        breastfeeding_stop_reason, 
        baby_born, 
        currently_breastfeeding, 
        exclusive_breastfeeding, 
        previous_nipple_pain_level, 
        nipple_cracking,
        pregnancy_week,  // 產前懷孕週數
        due_date,  // 當下預產期
        production_date,  // 產後生產日期
        original_due_date  // 原本預產期
    } = req.body;

    // 檢查必填欄位
    if (!user_id) {
        return res.status(400).send("User ID 為必填欄位");
    }
    console.log('接收到的資料:', req.body);

    // 定義 SQL 查詢語句，加入 ON DUPLICATE KEY UPDATE
    const fields = {
        user_id,
        pregnancy_babies_count,
        pregnancy_complications,
        willing_to_breastfeed,
        pregnancy_count,
        delivery_count,
        first_time_breastfeeding,
        expected_breastfeeding_months,
        first_time_delivery,
        previous_breastfeeding_duration_months,
        breastfeeding_stop_reason,
        baby_born,
        currently_breastfeeding,
        exclusive_breastfeeding,
        previous_nipple_pain_level,
        nipple_cracking,
        pregnancy_week,
        due_date,
        production_date,
        original_due_date
    };

    const keys = Object.keys(fields).filter(key => fields[key] !== undefined && fields[key] !== null);
    const columns = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const updateClause = keys.map(k => `${k} = VALUES(${k})`).join(', ');
    const values = keys.map(k => fields[k]);

    const query = `
        INSERT INTO user_question (${columns})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ 儲存或更新資料時出錯:', err);
            return res.status(500).send(`Error saving data: ${err.message}`);
        }
        res.send('✅ 資料已成功儲存或更新');
    });
});


// 更新問題 (PUT)
app.put('/user_question/:id', (req, res) => {
    const { id } = req.params;
    const updatedQuestion = req.body;
    db.query('UPDATE user_question SET ? WHERE question_id = ?', [updatedQuestion, id], (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (results.affectedRows === 0) {
            return res.status(404).send('Question not found');
        }
        res.send({ message: 'Question updated successfully' });
    });
});

// 刪除問題 (DELETE)
app.delete('/user_question/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM user_question WHERE question_id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (results.affectedRows === 0) {
            return res.status(404).send('Question not found');
        }
        res.send({ message: 'Question deleted successfully' });
    });
});


app.get('/fuzzy_search', (req, res) => {
    console.log('收到的查詢參數:', req.query);

    const { name, table, gender, birthdate, exportExcel } = req.query;

    if (!name) {
        return res.render('404', { message: '請輸入姓名進行查詢！' });
    }

    let query;
    const params = [`%${name}%`];

    if (table === "users+man_users") {
        query = `
            SELECT 'users' AS tableName, user_id AS id, user_name AS name, user_gender AS gender, user_birthdate AS birthdate,
                   user_account, user_phone, user_height, pre_pregnancy_weight, current_weight, chronic_illness, chronic_illness_details,
                   betel_nut_habit, smoking_habit, drinking_habit, user_salutation, marital_status
            FROM users
            WHERE user_name LIKE ?
            UNION
            SELECT 'man_users' AS tableName, man_user_id AS id, man_user_name AS name, man_user_gender AS gender, man_user_birthdate AS birthdate,
                   man_user_account, man_user_phone, man_user_height, NULL AS pre_pregnancy_weight, man_current_weight,
                   man_chronic_illness AS chronic_illness, man_chronic_illness_details AS chronic_illness_details,
                   man_betel_nut_habit AS betel_nut_habit, man_smoking_habit AS smoking_habit, man_drinking_habit AS drinking_habit,
                   man_user_salutation AS user_salutation, man_marital_status AS marital_status
            FROM man_users
            WHERE man_user_name LIKE ?
        `;
        params.push(`%${name}%`);
    } else {
        query = `
            SELECT * FROM ${table} WHERE ${table === "users" ? "user_name" : "man_user_name"} LIKE ?`;
    }

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error('SQL查詢錯誤:', err);
            return res.render('404', { message: '資料庫查詢失敗，請稍後重試！' });
        }

        if (exportExcel === "yes") {
            const queries = {
                attachment: `SELECT * FROM attachment WHERE user_name LIKE ?`,
                knowledge: `SELECT * FROM knowledge WHERE user_name LIKE ?`,
                dour: `SELECT * FROM dour WHERE user_name LIKE ?`,
                painscale: `SELECT * FROM painscale WHERE user_name LIKE ?`,
                roommate: `SELECT * FROM roommate WHERE user_name LIKE ?`,
                sleep: `SELECT * FROM sleep WHERE user_name LIKE ?`,
                user_question: `SELECT * FROM user_question WHERE user_name LIKE ?`
            };

            Promise.all(
                Object.entries(queries).map(([key, query]) => {
                    return new Promise((resolve, reject) => {
                        connection.query(query, params, (err, data) => {
                            if (err) return reject(err);
                            resolve({ sheetName: key, data });
                        });
                    });
                })
            ).then(sheets => {
                generateExcel(results, sheets, res);
            }).catch(err => {
                console.error('SQL 查詢錯誤:', err);
                res.render('404', { message: '問卷資料查詢失敗！' });
            });
        } else {
            res.render("fuzzy_search", { 
                users: table === "users" ? results : [], 
                manUsers: table === "man_users" ? results : [], 
                allUsers: table === "users+man_users" ? results : [],
                table
            });
        }
    });
});

function generateExcel(userData, sheets, res) {
    const workbook = new ExcelJS.Workbook();
    const userSheet = workbook.addWorksheet('個人資料');

    userSheet.columns = Object.keys(userData[0] || {}).map(key => ({ header: key, key, width: 20 }));
    userData.forEach(row => userSheet.addRow(row));

    sheets.forEach(({ sheetName, data }) => {
        const sheet = workbook.addWorksheet(sheetName);
        if (data.length > 0) {
            sheet.columns = Object.keys(data[0]).map(key => ({ header: key, key, width: 20 }));
            data.forEach(row => sheet.addRow(row));
        }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=問卷數據.xlsx');

    workbook.xlsx.write(res).then(() => res.end());
}



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



app.post('/download', async (req, res) => {
    const userIds = Array.isArray(req.body.user_ids) ? req.body.user_ids : [req.body.user_ids];
    const selectedSurveys = req.body.questionnaire || {}; // 問卷對應表

    console.log("✅ 收到的 user_ids:", userIds);
    console.log("✅ 收到的問卷對應:", selectedSurveys);

    if (!userIds.length) {
        return res.status(400).send("⚠️ 未選擇使用者");
    }

    connection.query("SELECT user_id FROM users WHERE user_id IN (?)", [userIds], (err, userResults) => {
        if (err) return res.status(500).send("⚠️ 查詢失敗: users");

        const userIdsFiltered = userResults.map(row => row.user_id);

        connection.query("SELECT man_user_id FROM man_users WHERE man_user_id IN (?)", [userIds], (err, manUserResults) => {
            if (err) return res.status(500).send("⚠️ 查詢失敗: man_users");

            const manUserIdsFiltered = manUserResults.map(row => row.man_user_id);
            queryDatabase(userIdsFiltered, manUserIdsFiltered, selectedSurveys, res);
        });
    });
});

function queryDatabase(userIdsFiltered, manUserIdsFiltered, selectedSurveys, res) {
    const queries = {
        親子依附量表: `SELECT * FROM attachment WHERE user_id IN (?)`,
        知識量表: `SELECT * FROM knowledge WHERE user_id IN (?)`,
        憂鬱量表: `SELECT * FROM dour WHERE user_id IN (?)`,
        產後傷口疼痛量表: `SELECT * FROM painscale WHERE user_id IN (?)`,
        親子同室量表: `SELECT * FROM roommate WHERE user_id IN (?)`,
        睡眠評估量表: `SELECT * FROM sleep WHERE user_id IN (?)`,
        產前後量表: `SELECT * FROM user_question WHERE user_id IN (?)`
    };

    Promise.all(
        Object.entries(queries).map(([key, query]) => {
            return new Promise((resolve, reject) => {
                connection.query(query, [userIdsFiltered], (err, results) => {
                    if (err) return reject(err);
                    resolve({ sheetName: key, data: results });
                });
            });
        })
    ).then(sheets => {
        generateExcel(userIdsFiltered, manUserIdsFiltered, sheets, res);
    }).catch(err => {
        console.error('SQL 查詢錯誤:', err);
        res.status(500).send("⚠️ 資料查詢失敗");
    });
}

function generateExcel(userIdsFiltered, manUserIdsFiltered, sheets, res) {
    const workbook = new ExcelJS.Workbook();
    // 生成「使用者資料」工作表
    const userSheet = workbook.addWorksheet('使用者資料');
    userSheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "姓名", key: "user_name", width: 20 },
        { header: "帳號", key: "user_account", width: 20 },
        { header: "電話", key: "user_phone", width: 15 },
        { header: "身高", key: "user_height", width: 10 },
        { header: "孕前體重", key: "pre_pregnancy_weight", width: 10 },
        { header: "目前體重", key: "current_weight", width: 10 },
        { header: "特殊疾病", key: "chronic_illness", width: 20 },
        { header: "疾病詳情", key: "chronic_illness_details", width: 20 },
        { header: "檳榔習慣", key: "betel_nut_habit", width: 10 },
        { header: "吸菸習慣", key: "smoking_habit", width: 10 },
        { header: "喝酒習慣", key: "drinking_habit", width: 10 },
        { header: "稱謂", key: "user_salutation", width: 10 },
        { header: "婚姻狀況", key: "marital_status", width: 15 }
    ];
    const attachmentQuestions = {
    user_id: "女性使用者 ID",
    attachment_question_content: "測驗內容",
    attachment_test_date: "測驗日期",
    attachment_answer_1: "看到孩子，我就會覺得心情好",
    attachment_answer_2: "我喜歡陪伴著孩子",
    attachment_answer_3: "和孩子在一起是一種享受",
    attachment_answer_4: "我喜歡抱著孩子的感覺",
    attachment_answer_5: "孩子加入我的生活，讓我感到幸福",
    attachment_answer_6: "陪在孩子身邊，讓我感到滿足",
    attachment_answer_7: "我喜歡欣賞孩子的表情或動作",
    attachment_answer_8: "我在照顧孩子的時候，會感到不耐煩",
    attachment_answer_9: "時時要滿足孩子的需求，讓我感到沮喪",
    attachment_answer_10: "如果孩子干擾到我的休息，我會感到討厭",
    attachment_answer_11: "我覺得自己像是個照顧孩子的機器",
    attachment_answer_12: "照顧孩子讓我感到筋疲力盡",
    attachment_answer_13: "我會對孩子生氣",
    attachment_answer_14: "我要保留自己的最佳精力給孩子",
    attachment_answer_15: "我看重孩子的需求甚過自己的",
    attachment_answer_16: "如果孩子受苦，我願意替他承受",
    attachment_answer_17: "即使我有其他重要事情，我還是以照顧孩子為第一",
    attachment_answer_18: "我願意因為孩子而減少自己的自由",
    attachment_answer_19: "對我而言，孩子是世界上最重要的",
    attachment_answer_20: "我能察覺孩子「想睡覺」的訊號",
    attachment_answer_21: "我會由孩子的表情或動作，來猜測他的需求",
    attachment_answer_22: "我知道孩子的需求和情緒",
    attachment_answer_23: "我能有效地安撫孩子",
    attachment_answer_24: "我會依照孩子的反應，來調整照顧他的方式",
    attachment_answer_25: "我對照顧孩子的方式有信心",
    attachment_score_a: "親近分數",
    attachment_score_b: "親職適應分數",
    attachment_score_c: "承諾分數",
    attachment_score_d: "回應信心分數"
};
const knowledgeQuestions = {
    user_id: "女性使用者 ID",
    man_user_id: "男性使用者 ID",
    knowledge_question_content: "測驗內容",
    knowledge_test_date: "測驗日期",
    knowledge_answer_1: "產後所分泌的初乳，無論量多量少都能增加嬰兒的免疫力",
    knowledge_answer_2: "母親乳房的大小會影響乳汁分泌的多寡",
    knowledge_answer_3: "母親過度疲倦、緊張、心情不好會使乳汁分泌減少",
    knowledge_answer_4: "母親的水分攝取不足會使乳汁減少，只要飲用大量的水就能使乳汁分泌持續增加",
    knowledge_answer_5: "產後初期母親應該訂定餵奶時間表，幫助嬰兒於固定的時間吸奶",
    knowledge_answer_6: "為促進乳汁的分泌，每次餵奶前都要做乳房的熱敷與按摩",
    knowledge_answer_7: "哺餵母乳時當嬰兒只含住乳頭，母親需重新調整姿勢，盡量讓嬰兒含住全部或部分乳暈",
    knowledge_answer_8: "為了幫助嬰兒成功含乳，母親可以手掌支托乳房，支托乳房的手指應遠離乳暈",
    knowledge_answer_9: "餵奶前後，母親不須用肥皂以及清水清洗乳頭",
    knowledge_answer_10: "即使母親的乳頭是平的或凹陷的，嬰兒還是可以吃到足夠的母乳",
    knowledge_answer_11: "產後初期當母親乳汁還沒來之前，嬰兒還是可以吃到足夠的母乳",
    knowledge_answer_12: "當母親感到乳頭有受傷或輕微破皮時，可以在哺餵完母乳後擠一些乳汁塗抹乳頭",
    knowledge_answer_13: "哺餵母乳時嬰兒嗜睡或哭鬧是母親乳汁不夠的徵象",
    knowledge_answer_14: "為避免嬰兒呼吸不順暢，哺餵母乳時母親需要用手指壓住嬰兒鼻子附近的乳房部位",
    knowledge_answer_15: "乳汁的分泌量主要是受到嬰兒的吸吮次數與吸吮時間所影響，當嬰兒吸吮次數越多、吸吮時間越久，母親的乳汁分泌量也會越多",
    knowledge_answer_16: "當母親感覺脹奶時，多讓嬰兒吸吮乳房是最佳的處理方式",
    knowledge_answer_17: "嬰兒生病的時候，為了讓嬰兒獲得適當的休息，母親應該暫停哺餵母乳",
    knowledge_answer_18: "當嬰兒體力較差或吸吮力弱，母親可以在嬰兒吸吮時同時用支托乳房的手擠乳協助",
    knowledge_answer_19: "產後初期混合哺餵配方奶，母親的乳汁分泌量會受到影響",
    knowledge_answer_20: "產後初期混合哺餵配方奶，會讓嬰兒在學習直接吸吮母親乳房時，需要花長一點的時間適應",
    knowledge_answer_21: "當哺餵母乳時嬰兒嗜睡，母親可以試著鬆開包巾或輕搓嬰兒四肢或耳朵",
    knowledge_answer_22: "沒有到病嬰室(嬰兒隔離病房)親餵嬰兒時，母親也需要規律地擠出乳汁",
    knowledge_answer_23: "擠乳時母親的手放在乳暈的位置，往乳頭方向來回擠壓",
    knowledge_answer_24: "嬰兒已經吃過的那瓶奶水，應該於當餐吃完，沒有吃完的話就需要丟掉",
    knowledge_answer_25: "產後初期乳汁未大量分泌前，母親應進行親自哺餵或擠奶，一天至少每三小時一次，每次至少十五分鐘",
    knowledge_score: "知識測驗分數"
};
const dourQuestions = {
    user_id: "女性使用者 ID",
    man_user_id: "男性使用者 ID",
    dour_question_content: "測驗內容",
    dour_test_date: "測驗日期",
    dour_answer_1: "我能開懷的笑並看到事物有趣的一面",
    dour_answer_2: "我能夠以快樂的心情來期待事情",
    dour_answer_3: "當事情不順利時，我會不必要地責備自己",
    dour_answer_4: "我會無緣無故感到焦慮和擔心",
    dour_answer_5: "我會無緣無故感到害怕和驚慌",
    dour_answer_6: "事情壓得我喘不過氣來",
    dour_answer_7: "我很不開心以致失眠",
    dour_answer_8: "我感到難過和悲傷",
    dour_answer_9: "我的不快樂導致我哭泣",
    dour_answer_10: "我會有傷害自己的想法",
    dour_score: "憂鬱測驗分數"
};
const painscaleQuestions = {
    user_id: "女性使用者 ID",
    painscale_question_content: "測驗內容",
    painscale_test_date: "測驗日期",
    childbirth_method: "生產方式(自然產=0、剖腹產=1)",
    pain_level: "疼痛等級",
    used_self_controlled_pain_relief: "是否使用自控式止痛"
};
const roommateQuestions = {
    user_id: "女性使用者 ID",
    roommate_question_content: "測驗內容",
    roommate_test_date: "測驗日期",
    roommate_answer_1: "截至目前為止是否有24小時同室",
    roommate_answer_2: "產後是否有住在月子中心"
};
const sleepQuestions = {
    user_id: "女性使用者 ID",
    sleep_question_content: "測驗內容",
    sleep_test_date: "測驗日期",
    sleep_answer_1_am_pm: "過去一個月來，您通常何時上床",
    sleep_answer_1_a: "過去一個月來，您通常何時上床 (時)",
    sleep_answer_1_b: "過去一個月來，您通常何時上床 (分)",
    sleep_answer_2: "過去一個月來，您通常多久才能入睡 (分)",
    sleep_answer_3_am_pm: "過去一個月來，您通常何時起床",
    sleep_answer_3_a: "過去一個月來，您通常何時起床 (時)",
    sleep_answer_3_b: "過去一個月來，您通常何時起床 (分)",
    sleep_answer_4: "過去一個月來，您通常實際睡眠時間 (時)",
    sleep_answer_5: "過去一個月內，您多常服用藥物幫助入睡",
    sleep_answer_6: "過去一個月內，您多常在用餐、開車或社交場合活動時感到困倦，難以保持清醒",
    sleep_answer_7: "過去一個月內，保持足夠的熱情去完成事情對您來說有多大問題",
    sleep_answer_8: "過去一個月來，整體而言，您覺得自己的睡眠品質如何",
    sleep_answer_9: "無法在30分鐘內入睡",
    sleep_answer_10: "半夜或凌晨便清醒",
    sleep_answer_11: "必須起來上廁所",
    sleep_answer_12: "無法舒適呼吸",
    sleep_answer_13: "大聲打呼或咳嗽",
    sleep_answer_14: "會覺得冷",
    sleep_answer_15: "覺得燥熱",
    sleep_answer_16: "睡覺時常會做惡夢",
    sleep_answer_17: "身上有疼痛",
    sleep_score_sleep_difficulty: "睡眠困難分數",
    sleep_score_duration: "睡眠時間分數",
    sleep_score_efficiency: "睡眠效率分數",
    sleep_score_disturbance: "睡眠干擾分數",
    sleep_score_medication: "睡眠用藥分數",
    sleep_score_daytime_function: "白天功能分數",
    sleep_score_subjective_quality: "主觀睡眠品質分數",
    sleep_score_total: "總分"
};
const userQuestionQuestions = {
    user_id: "女性使用者 ID",
    pregnancy_babies_count: "懷孕寶寶數",
    pregnancy_complications: "妊娠合併症",
    willing_to_breastfeed: "願意哺乳",
    pregnancy_count: "懷孕次數",
    delivery_count: "生產次數",
    first_time_breastfeeding: "首次哺乳",
    expected_breastfeeding_months: "預期哺乳月數",
    first_time_delivery: "首次生產",
    previous_breastfeeding_duration_months: "前次哺乳月數",
    breastfeeding_stop_reason: "停止哺乳原因",
    baby_born: "寶寶是否出生",
    currently_breastfeeding: "目前哺乳",
    exclusive_breastfeeding: "純母乳哺乳",
    previous_nipple_pain_level: "乳頭疼痛指數",
    nipple_cracking: "乳頭破皮狀況"
};

    Promise.all([
        getUserData('users', userIdsFiltered),
        getUserData('man_users', manUserIdsFiltered)
    ]).then(([users, manUsers]) => {
        [...users, ...manUsers].forEach(user => {
            userSheet.addRow(user);
        });
if (!res || typeof res.setHeader !== "function") {
        console.error("⚠️ res 不是 Express 回應物件，請檢查函數參數！");
        return;
    }

sheets.forEach(({ sheetName, data }) => {
    const sheet = workbook.addWorksheet(sheetName);

    const questionMapping = sheetName === "親子依附量表" ? attachmentQuestions 
                         : sheetName === "母乳哺餵知識問卷" ? breastfeedingQuestions 
                         : sheetName === "知識量表" ? knowledgeQuestions
                         : sheetName === "憂鬱量表" ? dourQuestions
                         : sheetName === "產後傷口疼痛量表" ? painscaleQuestions
                         : sheetName === "親子同室量表" ? roommateQuestions
                         : sheetName === "睡眠評估量表" ? sleepQuestions
                         : sheetName === "產前後量表" ? userQuestionQuestions
                         : null;

    if (questionMapping && Array.isArray(data) && data.length > 0) {
        const userIds = data.map(row => row.user_id);
        sheet.addRow(["問卷ID", ...userIds]); // 第一行是欄位名稱

        Object.keys(questionMapping).forEach((key) => {
            const rowData = [
                questionMapping[key], 
                ...data.map(row => row[key] !== null && row[key] !== undefined ? row[key] : "")
            ];
            sheet.addRow(rowData);
        });
// 設定第一欄寬度
sheet.getColumn(1).width = 90;

// 設定剩餘的所有欄位為 15
const totalColumns = sheet.columns.length; // 取得欄位總數
for (let colIndex = 2; colIndex <= totalColumns; colIndex++) {
    sheet.getColumn(colIndex).width = 15;
}
    }
});




        const filename = encodeURIComponent("資料下載.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        workbook.xlsx.write(res).then(() => res.end());
    }).catch(err => {
        console.error('使用者資料查詢錯誤:', err);
        res.status(500).send("⚠️ 使用者資料查詢失敗");
    });
}

function getUserData(tableName, userIds) {
    return new Promise((resolve, reject) => {
        if (!userIds.length) return resolve([]);
        const query = `
            SELECT ${tableName === 'users' ? 'user_id' : 'man_user_id'} AS id, 
                   ${tableName === 'users' ? 'user_name' : 'man_user_name'} AS user_name,  
                   ${tableName === 'users' ? 'user_account' : 'man_user_account'} AS user_account, 
                   ${tableName === 'users' ? 'user_phone' : 'man_user_phone'} AS user_phone, 
                   ${tableName === 'users' ? 'user_height' : 'man_user_height'} AS user_height, 
                   ${tableName === 'users' ? 'pre_pregnancy_weight' : 'NULL'} AS pre_pregnancy_weight, 
                   ${tableName === 'users' ? 'current_weight' : 'man_current_weight'} AS current_weight,
                   ${tableName === 'users' ? 'chronic_illness' : 'man_chronic_illness'} AS chronic_illness,
                   ${tableName === 'users' ? 'chronic_illness_details' : 'man_chronic_illness_details'} AS chronic_illness_details,
                   ${tableName === 'users' ? 'betel_nut_habit' : 'man_betel_nut_habit'} AS betel_nut_habit,
                   ${tableName === 'users' ? 'smoking_habit' : 'man_smoking_habit'} AS smoking_habit,
                   ${tableName === 'users' ? 'drinking_habit' : 'man_drinking_habit'} AS drinking_habit,
                   ${tableName === 'users' ? 'user_salutation' : 'man_user_salutation'} AS user_salutation,
                   ${tableName === 'users' ? 'marital_status' : 'man_marital_status'} AS marital_status
            FROM ${tableName} WHERE ${tableName === 'users' ? 'user_id' : 'man_user_id'} IN (?)`;
        
        connection.query(query, [userIds], (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}




app.post('/download_single', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) return res.status(400).send('⚠️ 使用者 ID 未提供');

    const query = `SELECT user_id, user_name, user_gender, user_birthdate, height, phone FROM users WHERE user_id = ?`;

    connection.query(query, [user_id], async (err, userData) => {
        if (err || !userData.length) {
            return res.status(404).send('⚠️ 找不到該使用者');
        }

        const user = userData[0];
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('個人資料');
        sheet.columns = [
            { header: '欄位名稱', key: 'field', width: 25 },
            { header: '內容', key: 'value', width: 40 }
        ];

        Object.entries(user).forEach(([key, value]) => {
            sheet.addRow({ field: key, value: value || '未提供' });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${user.user_name}_個人資料.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    });
});


// result 頁面 GET 請求
app.get('/result', (req, res) => {
    const userId = req.query.user_id || req.body.user_id;
    const manUserId = req.query.man_user_id || req.body.man_user_id;

    console.log('收到的查詢參數:', req.query);

    if (!userId && !manUserId) {
        console.warn('⚠️ 沒有 ID，跳轉到首頁');
        return res.redirect('/index');
    }

    let query;
    let params;
    let table;

    if (userId) {
        table = "users";
        query = `
            SELECT user_id AS id, user_name AS name, user_gender AS gender, 
                   DATE_FORMAT(user_birthdate, "%Y/%m/%d") AS formattedBirthdate, 
                   user_height AS height, current_weight AS current_weight, 
                   pre_pregnancy_weight AS pre_pregnancy_weight, user_phone AS phone, 
                   emergency_contact_name, emergency_contact_phone, 
                   emergency_contact_relation, emergency_contact_name2, 
                   emergency_contact_relation2, emergency_contact_phone2,
                   betel_nut_habit, smoking_habit, drinking_habit, contact_preference, 
                   chronic_illness, chronic_illness_details, marital_status, 
                   user_salutation, user_account, pairing_code
            FROM users WHERE user_id = ?`;
        params = [userId];
    } else {
        table = "man_users";
        query = `
            SELECT man_user_id AS id, man_user_name AS name, man_user_gender AS gender, 
                   DATE_FORMAT(man_user_birthdate, "%Y/%m/%d") AS formattedBirthdate, 
                   man_user_height AS height, man_current_weight AS current_weight, 
                   man_user_phone AS phone, man_emergency_contact_name, man_emergency_contact_phone, 
                   man_emergency_contact_relation, man_emergency_contact_name2, 
                   man_emergency_contact_relation2, man_emergency_contact_phone2,
                   man_betel_nut_habit, man_smoking_habit, man_drinking_habit, man_contact_preference, 
                   man_chronic_illness, man_chronic_illness_details, man_marital_status, 
                   man_user_salutation, man_user_account, man_pairing_code
            FROM man_users WHERE man_user_id = ?`;
        params = [manUserId];
    }

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error('❌ 資料庫查詢失敗:', err.message);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            console.warn('⚠️ 沒有找到符合的使用者，跳轉到首頁');
            return res.redirect('/index');
        }

        res.render('result', {
            table, 
            user: results[0],
            queryStringParam: table === "users" ? "user_id" : "man_user_id",
            recordId: results[0].id
        });
    });
});



app.get('/result/:user_id', (req, res) => {
    req.session.user_id = req.params.user_id; // 存儲 user_id 到 Session

    const query = 'SELECT * FROM users WHERE user_id = ?';
    connection.query(query, [req.session.user_id], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }
        res.render('result', { userData: results[0] });
    });
});



// result 頁面 POST 請求
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


// 獲取所有步數統計資料
app.get('/steps', (req, res) => {
    const userId = req.session.user_id || req.query.user_id;

    if (!userId) {
        return res.render('error', { message: '未提供使用者 ID！' });
    }

    // 🔹 查詢 `user_name` 及步數資料
    const query = `
        SELECT u.user_name, s.* 
        FROM steps s 
        JOIN users u ON s.user_id = u.user_id
        WHERE s.user_id = ?
        ORDER BY s.step_date ASC;
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.render('error', { message: '資料庫查詢失敗，請稍後重試！' });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        results.forEach(item => {
            const date = new Date(item.step_date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            item.formattedDate = `${year}/${month}/${day}`;
        });

        console.log("✅ 渲染 steps.ejs，傳遞資料:", results[0]);

        res.render("steps", {
            stepsData: results,
            userId,
            user_name: results[0].user_name // ✅ 傳遞 `user_name`
        });
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

    if (!user_id || !step_date || steps === undefined || goal === undefined) {
        return res.status(400).send('user_id, step_date, steps, and goal are required');
    }

    const completionRate = ((steps / goal) * 100).toFixed(2);

    // 查詢當天是否已有記錄
    const selectQuery = 'SELECT step_id FROM steps WHERE user_id = ? AND step_date = ?';
    connection.query(selectQuery, [user_id, step_date], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(`Error checking existing data: ${err.message}`);
        }

        if (results.length > 0) {
            // 若已有當天記錄，進行更新
            const stepId = results[0].step_id;
            const updateQuery = `
                UPDATE steps
                SET steps = ?, goal = ?, completion_rate = ?
                WHERE step_id = ?
            `;
            connection.query(updateQuery, [steps, goal, completionRate, stepId], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return res.status(500).send(`Error updating data: ${err.message}`);
                }
                res.send('Step data updated successfully');
            });
        } else {
            // 若無當天記錄，新增新記錄
            const insertQuery = `
                INSERT INTO steps (user_id, step_date, steps, goal, completion_rate)
                VALUES (?, ?, ?, ?, ?)
            `;
            connection.query(insertQuery, [user_id, step_date, steps, goal, completionRate], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return res.status(500).send(`Error saving data: ${err.message}`);
                }
                res.status(201).send('Step data added successfully');
            });
        }
    });
});
// 更新步數統計資料
app.put('/steps/:step_id', (req, res) => {
    const stepId = req.params.step_id;
    const { step_date, steps, goal } = req.body;

    if (!step_date || steps === undefined || goal === undefined) {
        return res.status(400).send('step_date, steps, and goal are required');
    }

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

//親子依附量表
app.get('/attachment', (req, res) => {
    const userId = req.query.user_id;

    console.log("🔍 API 獲取的 user_id:", userId);

    if (!userId) {
        return res.render("error", { message: "未登入，請先登入後再查看測驗結果！" });
    }

    // 🔹 查詢使用者名稱 & 附件資料
    const query = `
        SELECT u.user_name, a.* 
        FROM attachment a 
        JOIN users u ON a.user_id = u.user_id
        WHERE a.user_id = ?;
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error("❌ SQL 查詢錯誤:", err);
            return res.render("error", { message: "資料庫查詢失敗，請稍後重試！" });
        }

        if (results.length === 0) {
            console.log("⚠️ 查無此使用者資料");
            return res.redirect('/index');
        }

        // 🔹 格式化測驗日期
        results.forEach(data => {
            const testDate = new Date(data.attachment_test_date);
            data.formattedTestDate = `${testDate.getFullYear()}/${String(testDate.getMonth() + 1).padStart(2, '0')}/${String(testDate.getDate()).padStart(2, '0')}`;
        });

        console.log("✅ 渲染 attachment.ejs，傳遞資料:", results[0]);

        res.render("attachment", {
            attachmentData: results,
            userId,
            user_name: results[0].user_name // ✅ 傳遞 `user_name`
        });
    });
});
app.get('/attachment/:attachment_id', (req, res) => {
    const assessmentId = req.params.attachment_id;
    const query = 'SELECT * FROM attachment WHERE attachment_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error querying data: ${err.message}` });
            return;
        }
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).json({ error: 'Attachment assessment not found' });
        }
    });
});

app.post('/attachment', (req, res) => {
    const fields = {
        attachment_question_content: req.body.attachment_question_content,
        attachment_test_date: req.body.attachment_test_date,
        ...Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`attachment_answer_${i + 1}`, req.body[`attachment_answer_${i + 1}`]])),
        attachment_score_a: req.body.attachment_score_a,
        attachment_score_b: req.body.attachment_score_b,
        attachment_score_c: req.body.attachment_score_c,
        attachment_score_d: req.body.attachment_score_d
    };

    if (!req.body.user_id) {
        return res.status(400).send("User ID 為必填欄位");
    }

    // 🔹 **檢查 `user_id` 是否已存在**
    const checkQuery = `SELECT COUNT(*) AS count FROM attachment WHERE user_id = ?`;

    connection.query(checkQuery, [req.body.user_id], (err, result) => {
        if (err) {
            console.error('❌ 查詢失敗:', err);
            return res.status(500).send(`Error checking user: ${err.message}`);
        }

        const userExists = result[0].count > 0;
        const keys = Object.keys(fields).filter(key => fields[key] !== undefined && fields[key] !== null);
        const columns = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => fields[k]);

        if (!userExists) {
            // 🚀 `user_id` 不存在，執行 `INSERT`
            const insertQuery = `
                INSERT INTO attachment (user_id, ${columns})
                VALUES (?, ${placeholders})
            `;
            connection.query(insertQuery, [req.body.user_id, ...values], (err, result) => {
                if (err) {
                    console.error('❌ 插入資料錯誤:', err);
                    return res.status(500).send(`Error inserting data: ${err.message}`);
                }
                res.json({ message: "✅ 新增 attachment 資料成功", insertId: result.insertId });
            });

        } else {
            // 🔄 `user_id` 已存在，執行 `UPDATE`
            const updateClause = keys.map(k => `${k} = ?`).join(', ');
            const updateQuery = `
                UPDATE attachment
                SET ${updateClause}
                WHERE user_id = ?
            `;
            connection.query(updateQuery, [...values, req.body.user_id], (err, result) => {
                if (err) {
                    console.error('❌ 更新資料錯誤:', err);
                    return res.status(500).send(`Error updating data: ${err.message}`);
                }
                res.json({ message: "✅ 更新 attachment 資料成功" });
            });
        }
    });
});



app.put('/attachment/:attachment_id', (req, res) => {
    const attachmentId = req.params.attachment_id;
    const {
        user_id, attachment_question_content, attachment_test_date,
        attachment_answer_1, attachment_answer_2, attachment_answer_3,
        attachment_answer_4, attachment_answer_5, attachment_answer_6,
        attachment_answer_7, attachment_answer_8, attachment_answer_9,
        attachment_answer_10, attachment_answer_11, attachment_answer_12,
        attachment_answer_13, attachment_answer_14, attachment_answer_15,
        attachment_answer_16, attachment_answer_17, attachment_answer_18,
        attachment_answer_19, attachment_answer_20, attachment_answer_21,
        attachment_answer_22, attachment_answer_23, attachment_answer_24,
        attachment_answer_25, attachment_score_a, attachment_score_b,
        attachment_score_c, attachment_score_d
    } = req.body;

    // 檢查必填字段是否齊全
    if (!user_id || !attachment_question_content || !attachment_test_date ||
        attachment_answer_1 === undefined || attachment_answer_2 === undefined ||
        attachment_answer_3 === undefined || attachment_answer_4 === undefined ||
        attachment_answer_5 === undefined || attachment_answer_6 === undefined ||
        attachment_answer_7 === undefined || attachment_answer_8 === undefined ||
        attachment_answer_9 === undefined || attachment_answer_10 === undefined ||
        attachment_answer_11 === undefined || attachment_answer_12 === undefined ||
        attachment_answer_13 === undefined || attachment_answer_14 === undefined ||
        attachment_answer_15 === undefined || attachment_answer_16 === undefined ||
        attachment_answer_17 === undefined || attachment_answer_18 === undefined ||
        attachment_answer_19 === undefined || attachment_answer_20 === undefined ||
        attachment_answer_21 === undefined || attachment_answer_22 === undefined ||
        attachment_answer_23 === undefined || attachment_answer_24 === undefined ||
        attachment_answer_25 === undefined || attachment_score_a === undefined ||
        attachment_score_b === undefined || attachment_score_c === undefined ||
        attachment_score_d === undefined) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
        UPDATE attachment SET
            user_id = ?, attachment_question_content = ?, attachment_test_date = ?,
            attachment_answer_1 = ?, attachment_answer_2 = ?, attachment_answer_3 = ?,
            attachment_answer_4 = ?, attachment_answer_5 = ?, attachment_answer_6 = ?,
            attachment_answer_7 = ?, attachment_answer_8 = ?, attachment_answer_9 = ?,
            attachment_answer_10 = ?, attachment_answer_11 = ?, attachment_answer_12 = ?,
            attachment_answer_13 = ?, attachment_answer_14 = ?, attachment_answer_15 = ?,
            attachment_answer_16 = ?, attachment_answer_17 = ?, attachment_answer_18 = ?,
            attachment_answer_19 = ?, attachment_answer_20 = ?, attachment_answer_21 = ?,
            attachment_answer_22 = ?, attachment_answer_23 = ?, attachment_answer_24 = ?,
            attachment_answer_25 = ?, attachment_score_a = ?, attachment_score_b = ?,
            attachment_score_c = ?, attachment_score_d = ?
        WHERE attachment_id = ?
    `;

    const values = [
        user_id, attachment_question_content, attachment_test_date,
        attachment_answer_1, attachment_answer_2, attachment_answer_3,
        attachment_answer_4, attachment_answer_5, attachment_answer_6,
        attachment_answer_7, attachment_answer_8, attachment_answer_9,
        attachment_answer_10, attachment_answer_11, attachment_answer_12,
        attachment_answer_13, attachment_answer_14, attachment_answer_15,
        attachment_answer_16, attachment_answer_17, attachment_answer_18,
        attachment_answer_19, attachment_answer_20, attachment_answer_21,
        attachment_answer_22, attachment_answer_23, attachment_answer_24,
        attachment_answer_25, attachment_score_a, attachment_score_b,
        attachment_score_c, attachment_score_d, attachmentId
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error updating data: ${err.message}` });
            return;
        }

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'No record found for the specified attachment_id' });
        } else {
            res.json({ message: 'Attachment assessment updated successfully' });
        }
    });
});


app.delete('/attachment/:attachment_id', (req, res) => {
    const assessmentId = req.params.attachment_id;

    const query = 'DELETE FROM attachment WHERE attachment_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'Attachment assessment deleted successfully' });
        } else {
            res.status(404).json({ error: 'Attachment assessment not found' });
        }
    });
});

app.get('/dour', (req, res) => {
    const userId = req.query.user_id;
    const manUserId = req.query.man_user_id;

    if (!userId && !manUserId) {
        return res.redirect('/index'); // 如果沒有 ID，就返回首頁
    }

    // 🔹 確保查詢的是 `dour` 表
    const idColumn = userId ? "user_id" : "man_user_id";
    const queryParam = userId || manUserId;

    const query = `
        SELECT u.${userId ? "user_name" : "man_user_name"} AS name, d.* 
        FROM dour d 
        LEFT JOIN ${userId ? "users" : "man_users"} u ON d.${idColumn} = u.${idColumn}
        WHERE d.${idColumn} = ?
        ORDER BY d.dour_test_date ASC;
    `;

    connection.query(query, [queryParam], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        console.log("✅ 渲染 dour.ejs，傳遞資料:", results[0]);

       res.render("dour", {
    assessmentsData: results,
    userId: queryParam, // ✅ 確保傳遞正確的 ID
    user_name: results[0].name, // ✅ `user_name` 統一為 `name`
    table: userId ? "users" : "man_users" // ✅ 添加 `table`

        });
    });
});


// **獲取特定測驗數據 (GET by ID)**
app.get('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;
    const query = 'SELECT * FROM dour WHERE dour_id = ?;';

    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(404).render('error', { message: '未找到該測驗數據' });
        }

        res.render('dour_detail', { assessment: results[0] });
    });
});
// 新增測驗數據 (POST)
app.post('/dour', (req, res) => {
    const {
        user_id, man_user_id, dour_question_content, dour_test_date,
        dour_answer_1, dour_answer_2, dour_answer_3,
        dour_answer_4, dour_answer_5, dour_answer_6,
        dour_answer_7, dour_answer_8, dour_answer_9,
        dour_answer_10, dour_score
    } = req.body;

    // 確保 user_id 和 man_user_id 至少有一個存在
    if ((!user_id && !man_user_id) || !dour_question_content || !dour_test_date || 
        dour_answer_1 === undefined || dour_answer_2 === undefined || 
        dour_answer_3 === undefined || dour_answer_4 === undefined ||
        dour_answer_5 === undefined || dour_answer_6 === undefined || 
        dour_answer_7 === undefined || dour_answer_8 === undefined ||
        dour_answer_9 === undefined || dour_answer_10 === undefined || 
        dour_score === undefined) {
        return res.status(400).json({ error: '請提供 user_id 或 man_user_id，並確保其他必要欄位齊全' });
    }

    const query = `
        INSERT INTO dour (
            user_id, man_user_id, dour_question_content, dour_test_date,
            dour_answer_1, dour_answer_2, dour_answer_3, dour_answer_4,
            dour_answer_5, dour_answer_6, dour_answer_7, dour_answer_8,
            dour_answer_9, dour_answer_10, dour_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        user_id !== undefined ? user_id : null,
        man_user_id !== undefined ? man_user_id : null,
        dour_question_content, dour_test_date,
        dour_answer_1, dour_answer_2, dour_answer_3, dour_answer_4,
        dour_answer_5, dour_answer_6, dour_answer_7, dour_answer_8,
        dour_answer_9, dour_answer_10, dour_score
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error saving data: ${err.message}` });
            return;
        }
        res.status(201).send({ message: 'Dour assessment saved successfully', insertId: result.insertId });
    });
});



// 更新測驗數據 (PUT)
app.put('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;
    const {
        user_id, dour_question_content, dour_test_date,
        dour_answer_1, dour_answer_2, dour_answer_3,
        dour_answer_4, dour_answer_5, dour_answer_6,
        dour_answer_7, dour_answer_8, dour_answer_9,
        dour_answer_10, dour_score, man_user_id
    } = req.body;

    if (!user_id || !dour_question_content || !dour_test_date || 
        dour_answer_1 === undefined || dour_answer_2 === undefined || 
        dour_answer_3 === undefined || dour_answer_4 === undefined ||
        dour_answer_5 === undefined || dour_answer_6 === undefined || 
        dour_answer_7 === undefined || dour_answer_8 === undefined ||
        dour_answer_9 === undefined || dour_answer_10 === undefined || 
        dour_score === undefined) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
        UPDATE dour SET 
            user_id = ?, dour_question_content = ?, dour_test_date = ?,
            dour_answer_1 = ?, dour_answer_2 = ?, dour_answer_3 = ?, dour_answer_4 = ?,
            dour_answer_5 = ?, dour_answer_6 = ?, dour_answer_7 = ?, dour_answer_8 = ?,
            dour_answer_9 = ?, dour_answer_10 = ?, dour_score = ?, man_user_id = ?
        WHERE dour_id = ?
    `;

    const values = [
        user_id, dour_question_content, dour_test_date,
        dour_answer_1, dour_answer_2, dour_answer_3, dour_answer_4,
        dour_answer_5, dour_answer_6, dour_answer_7, dour_answer_8,
        dour_answer_9, dour_answer_10, dour_score, man_user_id, assessmentId
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ SQL 執行錯誤:', err);
            res.status(500).json({ error: `更新失敗: ${err.message}` });
            return;
        }

        res.send({ message: '✅ Dour assessment updated successfully' });
    });
});



// 刪除測驗數據 (DELETE)
app.delete('/dour/:dour_id', (req, res) => {
    const assessmentId = req.params.dour_id;

    const query = 'DELETE FROM dour WHERE dour_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        res.json({ message: 'Dour assessment deleted successfully' });
    });
});
// 獲取所有疼痛測量數據 (GET)
app.get('/painscale', (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.redirect('/index'); // 如果沒有 user_id，就返回首頁
    }

    // 🔹 查詢 `user_name` 及疼痛量表測驗資料
    const query = `
        SELECT u.user_name, p.* 
        FROM painscale p 
        JOIN users u ON p.user_id = u.user_id
        WHERE p.user_id = ?
        ORDER BY p.painscale_test_date ASC;
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        console.log("✅ 渲染 painscale.ejs，傳遞資料:", results[0]);

        res.render("painscale", {
            painscaleData: results,
            userId,
            user_name: results[0].user_name // ✅ 傳遞 `user_name`
        });
    });
});


// **獲取特定疼痛測量數據 (GET by ID)**
app.get('/painscale/:painscale_id', (req, res) => {
    const assessmentId = req.params.painscale_id;
    const query = 'SELECT * FROM painscale WHERE painscale_id = ?;';

    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).send(`資料庫查詢失敗: ${err.message}`);
        }

        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('未找到疼痛測量記錄');
        }
    });
});
// 新增疼痛測量數據 (POST)
app.post('/painscale', (req, res) => {
    const {
        user_id, painscale_question_content, painscale_test_date,
        childbirth_method, pain_level, used_self_controlled_pain_relief
    } = req.body;

    if (!user_id || !painscale_question_content || !painscale_test_date ||
        !childbirth_method || pain_level === undefined) {
        return res.status(400).json({ error: 'All fields are required except used_self_controlled_pain_relief' });
    }

    const query = `
        INSERT INTO painscale (
            user_id, painscale_question_content, painscale_test_date,
            childbirth_method, pain_level, used_self_controlled_pain_relief
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        user_id, painscale_question_content, painscale_test_date,
        childbirth_method, pain_level, used_self_controlled_pain_relief || null
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error saving data: ${err.message}` });
            return;
        }
        res.status(201).json({ message: 'Painscale assessment saved successfully', insertId: result.insertId });
    });
});

// 更新疼痛測量數據 (PUT)
app.put('/painscale/:painscale_id', (req, res) => {
    const assessmentId = req.params.painscale_id;
    const {
        user_id, painscale_question_content, painscale_test_date,
        childbirth_method, pain_level, used_self_controlled_pain_relief
    } = req.body;

    const query = `
        UPDATE painscale SET
            user_id = ?, painscale_question_content = ?, painscale_test_date = ?,
            childbirth_method = ?, pain_level = ?, used_self_controlled_pain_relief = ?
        WHERE painscale_id = ?
    `;

    const values = [
        user_id, painscale_question_content, painscale_test_date,
        childbirth_method, pain_level, used_self_controlled_pain_relief || null,
        assessmentId
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error updating data: ${err.message}` });
            return;
        }
        res.json({ message: 'Painscale assessment updated successfully' });
    });
});

// 刪除疼痛測量數據 (DELETE)
app.delete('/painscale/:painscale_id', (req, res) => {
    const assessmentId = req.params.painscale_id;

    const query = 'DELETE FROM painscale WHERE painscale_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'Painscale assessment deleted successfully' });
        } else {
            res.status(404).json({ error: 'Painscale assessment not found' });
        }
    });
});

// 獲取所有知識測試數據 (GET)
app.get('/knowledge', (req, res) => {
    const userId = req.query.user_id;
    const manUserId = req.query.man_user_id;

    if (!userId && !manUserId) {
        return res.redirect('/index'); // 如果沒有 ID，就返回首頁
    }

    // 🔹 根據 ID 決定查詢 `users` 或 `man_users`
    const table = userId ? "users" : "man_users";
    const assessmentTable = "knowledge"; // ✅ `knowledge` 表同時存儲 `user_id` 和 `man_user_id`
    const idColumn = userId ? "user_id" : "man_user_id";
    const queryParam = userId || manUserId;

    // 🔹 查詢使用者名稱 & 知識測驗資料
    const query = `
        SELECT u.${table === "users" ? "user_name" : "man_user_name"} AS name, k.* 
        FROM ${assessmentTable} k 
        JOIN ${table} u ON k.${idColumn} = u.${idColumn}
        WHERE k.${idColumn} = ?
        ORDER BY k.knowledge_test_date ASC;
    `;

    connection.query(query, [queryParam], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若無資料，回首頁
        }

        console.log("✅ 渲染 knowledge.ejs，傳遞資料:", results[0]);

        res.render("knowledge", {
            assessmentsData: results,
            userId: queryParam, // ✅ 確保傳遞正確的 ID
            user_name: results[0].name, // ✅ `user_name` 統一為 `name`
            table // ✅ 傳遞 table，讓 EJS 知道是 users 或 man_users
        });
    });
});



// **獲取特定知識測試數據 (GET by ID)**
app.get('/knowledge/:knowledge_id', (req, res) => {
    const assessmentId = req.params.knowledge_id;
    const query = 'SELECT * FROM knowledge WHERE knowledge_id = ?;';

    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(404).render('error', { message: '未找到該知識測試數據' });
        }

        res.render('knowledge_detail', { assessment: results[0] });
    });
});

app.post('/knowledge', (req, res) => {
    const {
        user_id, man_user_id, knowledge_question_content, knowledge_test_date,
        knowledge_answer_1, knowledge_answer_2, knowledge_answer_3,
        knowledge_answer_4, knowledge_answer_5, knowledge_answer_6,
        knowledge_answer_7, knowledge_answer_8, knowledge_answer_9,
        knowledge_answer_10, knowledge_answer_11, knowledge_answer_12,
        knowledge_answer_13, knowledge_answer_14, knowledge_answer_15,
        knowledge_answer_16, knowledge_answer_17, knowledge_answer_18,
        knowledge_answer_19, knowledge_answer_20, knowledge_answer_21,
        knowledge_answer_22, knowledge_answer_23, knowledge_answer_24,
        knowledge_answer_25, knowledge_score
    } = req.body;

    if ((!user_id && !man_user_id) || !knowledge_question_content || !knowledge_test_date || knowledge_score === undefined) {
        return res.status(400).json({ error: '至少提供 user_id 或 man_user_id，knowledge_question_content, knowledge_test_date, 和 knowledge_score 也必須存在' });
    }

    const query = `
        INSERT INTO knowledge (
            user_id, man_user_id, knowledge_question_content, knowledge_test_date,
            knowledge_answer_1, knowledge_answer_2, knowledge_answer_3,
            knowledge_answer_4, knowledge_answer_5, knowledge_answer_6,
            knowledge_answer_7, knowledge_answer_8, knowledge_answer_9,
            knowledge_answer_10, knowledge_answer_11, knowledge_answer_12,
            knowledge_answer_13, knowledge_answer_14, knowledge_answer_15,
            knowledge_answer_16, knowledge_answer_17, knowledge_answer_18,
            knowledge_answer_19, knowledge_answer_20, knowledge_answer_21,
            knowledge_answer_22, knowledge_answer_23, knowledge_answer_24,
            knowledge_answer_25, knowledge_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
        user_id || null, man_user_id || null, knowledge_question_content, knowledge_test_date,
        knowledge_answer_1, knowledge_answer_2, knowledge_answer_3,
        knowledge_answer_4, knowledge_answer_5, knowledge_answer_6,
        knowledge_answer_7, knowledge_answer_8, knowledge_answer_9,
        knowledge_answer_10, knowledge_answer_11, knowledge_answer_12,
        knowledge_answer_13, knowledge_answer_14, knowledge_answer_15,
        knowledge_answer_16, knowledge_answer_17, knowledge_answer_18,
        knowledge_answer_19, knowledge_answer_20, knowledge_answer_21,
        knowledge_answer_22, knowledge_answer_23, knowledge_answer_24,
        knowledge_answer_25, knowledge_score
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error saving data: ${err.message}` });
            return;
        }
        res.status(200).send({ message: "Knowledge data saved successfully", insertId: result.insertId });
    });
});



app.put('/knowledge/:user_id', (req, res) => {
    const { user_id } = req.params; // 從請求參數中提取 user_id
    const {
        knowledge_question_content, knowledge_test_date,
        knowledge_answer_1, knowledge_answer_2, knowledge_answer_3,
        knowledge_answer_4, knowledge_answer_5, knowledge_answer_6,
        knowledge_answer_7, knowledge_answer_8, knowledge_answer_9,
        knowledge_answer_10, knowledge_answer_11, knowledge_answer_12,
        knowledge_answer_13, knowledge_answer_14, knowledge_answer_15,
        knowledge_answer_16, knowledge_answer_17, knowledge_answer_18,
        knowledge_answer_19, knowledge_answer_20, knowledge_answer_21,
        knowledge_answer_22, knowledge_answer_23, knowledge_answer_24,
        knowledge_answer_25, knowledge_score, man_user_id 
    } = req.body;

    // 檢查必要的欄位是否存在
    if (!knowledge_question_content || !knowledge_test_date || knowledge_score === undefined) {
        return res.status(400).json({ error: 'knowledge_question_content, knowledge_test_date, and knowledge_score are required' });
    }

    // SQL 更新語句
    const query = `
        UPDATE knowledge SET
            knowledge_question_content = ?, knowledge_test_date = ?,
            knowledge_answer_1 = ?, knowledge_answer_2 = ?, knowledge_answer_3 = ?,
            knowledge_answer_4 = ?, knowledge_answer_5 = ?, knowledge_answer_6 = ?,
            knowledge_answer_7 = ?, knowledge_answer_8 = ?, knowledge_answer_9 = ?,
            knowledge_answer_10 = ?, knowledge_answer_11 = ?, knowledge_answer_12 = ?,
            knowledge_answer_13 = ?, knowledge_answer_14 = ?, knowledge_answer_15 = ?,
            knowledge_answer_16 = ?, knowledge_answer_17 = ?, knowledge_answer_18 = ?,
            knowledge_answer_19 = ?, knowledge_answer_20 = ?, knowledge_answer_21 = ?,
            knowledge_answer_22 = ?, knowledge_answer_23 = ?, knowledge_answer_24 = ?,
            knowledge_answer_25 = ?, knowledge_score = ?, man_user_id = ? 
        WHERE user_id = ?
    `;

    // SQL 值列表
    const values = [
        knowledge_question_content, knowledge_test_date,
        knowledge_answer_1, knowledge_answer_2, knowledge_answer_3,
        knowledge_answer_4, knowledge_answer_5, knowledge_answer_6,
        knowledge_answer_7, knowledge_answer_8, knowledge_answer_9,
        knowledge_answer_10, knowledge_answer_11, knowledge_answer_12,
        knowledge_answer_13, knowledge_answer_14, knowledge_answer_15,
        knowledge_answer_16, knowledge_answer_17, knowledge_answer_18,
        knowledge_answer_19, knowledge_answer_20, knowledge_answer_21,
        knowledge_answer_22, knowledge_answer_23, knowledge_answer_24,
        knowledge_answer_25, knowledge_score, man_user_id, user_id 
    ];

    // 執行 SQL 查詢
    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err); // 輸出錯誤細節
        res.status(500).json({ error: `Error updating data: ${err.message}` }); // 返回 500 錯誤
        return;
        }

        if (result.affectedRows === 0) {
            // 如果沒有任何行被更新，返回 404
            res.status(404).send({ message: 'No record found for the specified user_id' });
        } else {
            // 更新成功，返回成功消息
            res.send({ message: 'Knowledge data updated successfully' });
        }
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
    const userId = req.query.user_id;
    const manUserId = req.query.man_user_id;

    if (!userId && !manUserId) {
        return res.redirect('/index'); // 如果沒有 ID，就返回首頁
    }

    // 🔹 根據 ID 決定查詢 `users` 或 `man_users`
    const table = userId ? "users" : "man_users";
    const assessmentTable = "sleep"; // ✅ `sleep` 表同時存儲 `user_id` 和 `man_user_id`
    const idColumn = userId ? "user_id" : "man_user_id";
    const queryParam = userId || manUserId;

    // 🔹 查詢使用者名稱 & 睡眠評估資料
    const query = `
        SELECT u.${table === "users" ? "user_name" : "man_user_name"} AS name, s.* 
        FROM ${assessmentTable} s 
        JOIN ${table} u ON s.${idColumn} = u.${idColumn}
        WHERE s.${idColumn} = ?
        ORDER BY s.sleep_test_date ASC;
    `;

    connection.query(query, [queryParam], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若無資料，回首頁
        }

        console.log("✅ 渲染 sleep.ejs，傳遞資料:", results[0]);

        res.render("sleep", {
            assessmentsData: results,
            userId: queryParam, // ✅ 確保傳遞正確的 ID
            user_name: results[0].name, // ✅ `user_name` 統一為 `name`
            table // ✅ 傳遞 table，讓 EJS 知道是 users 或 man_users
        });
    });
});



// **獲取特定睡眠測試數據 (GET by ID)**
app.get('/sleep/:sleep_id', (req, res) => {
    const sleepId = req.params.sleep_id;
    const query = 'SELECT * FROM sleep WHERE sleep_id = ?;';

    connection.query(query, [sleepId], (err, results) => {
        if (err) {
            console.error('SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(404).render('error', { message: '未找到該睡眠測試數據' });
        }

        res.render('sleep_detail', { assessment: results[0] });
    });
});
app.post('/sleep', (req, res) => {
    const {
        user_id, man_user_id, sleep_question_content, sleep_test_date,
        sleep_answer_1_a, sleep_answer_1_b, sleep_answer_2,
        sleep_answer_3_a, sleep_answer_3_b, sleep_answer_4,
        sleep_answer_5, sleep_answer_6, sleep_answer_7, sleep_answer_8,
        sleep_answer_9, sleep_answer_10, sleep_answer_11, sleep_answer_12,
        sleep_answer_13, sleep_answer_14, sleep_answer_15, sleep_answer_16,
        sleep_answer_17, sleep_score_sleep_difficulty, sleep_score_duration,
        sleep_score_efficiency, sleep_score_disturbance, sleep_score_medication,
        sleep_score_daytime_function, sleep_score_total, sleep_score_subjective_quality,
        sleep_answer_1_am_pm, sleep_answer_3_am_pm
    } = req.body;

    // 確保所有必填欄位齊全
    if ((!user_id && !man_user_id) || !sleep_question_content || !sleep_test_date ||
        sleep_answer_1_a === undefined || sleep_answer_1_b === undefined ||
        sleep_answer_2 === undefined || sleep_answer_3_a === undefined ||
        sleep_answer_3_b === undefined || sleep_answer_4 === undefined ||
        sleep_answer_5 === undefined || sleep_answer_6 === undefined ||
        sleep_answer_7 === undefined || sleep_answer_8 === undefined ||
        sleep_answer_9 === undefined || sleep_answer_10 === undefined ||
        sleep_answer_11 === undefined || sleep_answer_12 === undefined ||
        sleep_answer_13 === undefined || sleep_answer_14 === undefined ||
        sleep_answer_15 === undefined || sleep_answer_16 === undefined ||
        sleep_answer_17 === undefined || sleep_score_sleep_difficulty === undefined ||
        sleep_score_duration === undefined || sleep_score_efficiency === undefined ||
        sleep_score_disturbance === undefined || sleep_score_medication === undefined ||
        sleep_score_daytime_function === undefined || sleep_score_total === undefined ||
        sleep_score_subjective_quality === undefined || sleep_answer_1_am_pm === undefined ||
        sleep_answer_3_am_pm === undefined) {
        return res.status(400).json({ error: '請確保所有必要欄位齊全' });
    }

    const query = `
        INSERT INTO sleep (
            user_id, man_user_id, sleep_question_content, sleep_test_date,
            sleep_answer_1_a, sleep_answer_1_b, sleep_answer_2,
            sleep_answer_3_a, sleep_answer_3_b, sleep_answer_4,
            sleep_answer_5, sleep_answer_6, sleep_answer_7, sleep_answer_8,
            sleep_answer_9, sleep_answer_10, sleep_answer_11, sleep_answer_12,
            sleep_answer_13, sleep_answer_14, sleep_answer_15, sleep_answer_16,
            sleep_answer_17, sleep_score_sleep_difficulty, sleep_score_duration,
            sleep_score_efficiency, sleep_score_disturbance, sleep_score_medication,
            sleep_score_daytime_function, sleep_score_total, sleep_score_subjective_quality,
            sleep_answer_1_am_pm, sleep_answer_3_am_pm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        user_id !== undefined ? user_id : null,
        man_user_id !== undefined ? man_user_id : null,
        sleep_question_content, sleep_test_date,
        sleep_answer_1_a, sleep_answer_1_b, sleep_answer_2,
        sleep_answer_3_a, sleep_answer_3_b, sleep_answer_4,
        sleep_answer_5, sleep_answer_6, sleep_answer_7, sleep_answer_8,
        sleep_answer_9, sleep_answer_10, sleep_answer_11, sleep_answer_12,
        sleep_answer_13, sleep_answer_14, sleep_answer_15, sleep_answer_16,
        sleep_answer_17, sleep_score_sleep_difficulty, sleep_score_duration,
        sleep_score_efficiency, sleep_score_disturbance, sleep_score_medication,
        sleep_score_daytime_function, sleep_score_total, sleep_score_subjective_quality,
        sleep_answer_1_am_pm, sleep_answer_3_am_pm
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ 錯誤:', err);
            res.status(500).json({ error: `存入數據失敗: ${err.message}` });
            return;
        }
        res.status(201).json({ message: '✅ 睡眠評估存入成功', insertId: result.insertId });
    });
});



// 更新睡眠測量數據 (PUT)
app.put('/sleep/:sleep_id', (req, res) => {
    const sleepId = req.params.sleep_id;
    const updates = req.body;

    // 確認 sleep_id 是否存在
    const checkQuery = 'SELECT COUNT(*) AS count FROM sleep WHERE sleep_id = ?';
    connection.query(checkQuery, [sleepId], (err, results) => {
        if (err) {
            console.error('❌ 錯誤:', err);
            res.status(500).json({ error: `查詢錯誤: ${err.message}` });
            return;
        }

        if (results[0].count === 0) {
            res.status(404).json({ error: '找不到此紀錄' });
            return;
        }

        // 允許更新的欄位
        const allowedFields = [
            'user_id', 'sleep_question_content', 'sleep_test_date',
            'sleep_answer_1_a', 'sleep_answer_1_b', 'sleep_answer_2',
            'sleep_answer_3_a', 'sleep_answer_3_b', 'sleep_answer_4',
            'sleep_answer_5', 'sleep_answer_6', 'sleep_answer_7', 'sleep_answer_8',
            'sleep_answer_9', 'sleep_answer_10', 'sleep_answer_11', 'sleep_answer_12',
            'sleep_answer_13', 'sleep_answer_14', 'sleep_answer_15', 'sleep_answer_16',
            'sleep_answer_17', 'sleep_score_sleep_difficulty', 'sleep_score_duration',
            'sleep_score_efficiency', 'sleep_score_disturbance', 'sleep_score_medication',
            'sleep_score_daytime_function', 'sleep_score_total', 'sleep_score_subjective_quality',
            'man_user_id','sleep_answer_1_am_pm','sleep_answer_3_am_pm'
        ];

        // 過濾符合規範的欄位
        const fieldsToUpdate = Object.keys(updates).filter(field => allowedFields.includes(field));

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ error: '沒有可更新的欄位' });
        }

        // 組合更新 SQL
        const query = `UPDATE sleep SET ${fieldsToUpdate.map(field => `${field} = ?`).join(', ')} WHERE sleep_id = ?`;
        const values = [...fieldsToUpdate.map(field => updates[field]), sleepId];

        connection.query(query, values, (err, result) => {
            if (err) {
                console.error('❌ 更新錯誤:', err);
                res.status(500).json({ error: `更新失敗: ${err.message}` });
                return;
            }
            res.json({ message: '✅ 睡眠評估更新成功' });
        });
    });
});



// 刪除睡眠測量數據 (DELETE)
app.delete('/sleep/:sleep_id', (req, res) => {
    const assessmentId = req.params.sleep_id;

    const query = 'DELETE FROM sleep WHERE sleep_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'Sleep assessment deleted successfully' });
        } else {
            res.status(404).json({ error: 'Sleep assessment not found' });
        }
    });
});
//親子同室
app.get('/roommate', (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.redirect('/index'); // 如果沒有 user_id，就返回首頁
    }

    // 🔹 查詢 `user_name` 及親子同室測驗資料
    const query = `
        SELECT u.user_name, r.* 
        FROM roommate r 
        JOIN users u ON r.user_id = u.user_id
        WHERE r.user_id = ?
        ORDER BY r.roommate_test_date ASC;
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error('❌ SQL 查詢錯誤:', err);
            return res.status(500).render('error', { message: `資料庫查詢失敗: ${err.message}` });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        console.log("✅ 渲染 roommate.ejs，傳遞資料:", results[0]);

        res.render("roommate", {
            roommateData: results,
            userId,
            user_name: results[0].user_name // ✅ 傳遞 `user_name`
        });
    });
});

app.get('/roommate/:roommate_id', (req, res) => {
    const assessmentId = req.params.roommate_id;
    const query = 'SELECT * FROM roommate WHERE roommate_id = ?';
    connection.query(query, [assessmentId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error querying data: ${err.message}` });
            return;
        }
        if (results.length > 0) {
            res.json(results[0]); // 返回特定測驗數據
        } else {
            res.status(404).json({ error: 'Roommate assessment not found' });
        }
    });
});

app.post('/roommate', (req, res) => {
    const {
        user_id, roommate_question_content, roommate_test_date,
        roommate_answer_1, roommate_answer_2
    } = req.body;

    if (!user_id || !roommate_question_content || !roommate_test_date ||
        roommate_answer_1 === undefined || roommate_answer_2 === undefined) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `
        INSERT INTO roommate (
            user_id, roommate_question_content, roommate_test_date,
            roommate_answer_1, roommate_answer_2
        ) VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
        user_id, roommate_question_content, roommate_test_date,
        roommate_answer_1, roommate_answer_2
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error saving data: ${err.message}` });
            return;
        }
        res.status(201).json({ message: 'Roommate assessment saved successfully', insertId: result.insertId });
    });
});

app.put('/roommate/:roommate_id', (req, res) => {
    const assessmentId = req.params.roommate_id;
    const {
        user_id, roommate_question_content, roommate_test_date,
        roommate_answer_1, roommate_answer_2
    } = req.body;

    const query = `
        UPDATE roommate SET
            user_id = ?, roommate_question_content = ?, roommate_test_date = ?,
            roommate_answer_1 = ?, roommate_answer_2 = ?
        WHERE roommate_id = ?
    `;

    const values = [
        user_id, roommate_question_content, roommate_test_date,
        roommate_answer_1, roommate_answer_2, assessmentId
    ];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error updating data: ${err.message}` });
            return;
        }
        res.json({ message: 'Roommate assessment updated successfully' });
    });
});

app.delete('/roommate/:roommate_id', (req, res) => {
    const assessmentId = req.params.roommate_id;

    const query = 'DELETE FROM roommate WHERE roommate_id = ?';
    connection.query(query, [assessmentId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: `Error deleting data: ${err.message}` });
            return;
        }
        if (result.affectedRows > 0) {
            res.json({ message: 'Roommate assessment deleted successfully' });
        } else {
            res.status(404).json({ error: 'Roommate assessment not found' });
        }
    });
});

// 獲取所有分析結果資料
app.get('/analysis', (req, res) => {
    console.log("🔍 伺服器收到的 URL:", req.url);
    console.log("🔍 req.query:", req.query);

    const userId = req.query.user_id;
    const manUserId = req.query.man_user_id;

    if (!userId && !manUserId) {
        console.log("⚠️ 缺少有效的 ID");
        return res.status(400).json({ error: "❌ 缺少有效的 ID，請在 URL 加上 ?user_id=1 或 ?man_user_id=1" });
    }

    // 🔹 根據 ID 決定查詢 `users` 或 `man_users`
    const table = userId ? "users" : "man_users";
    const idColumn = userId ? "user_id" : "man_user_id";
    const queryParam = userId || manUserId;

    // 🔹 查詢 `user_name` 及 `analysis` 資料
    const query = `
        SELECT u.${table === "users" ? "user_name" : "man_user_name"} AS name, a.* 
        FROM analysis a 
        JOIN ${table} u ON a.${idColumn} = u.${idColumn}
        WHERE a.${idColumn} = ?
        ORDER BY a.analysis_id DESC
        LIMIT 1;
    `;

    connection.query(query, [queryParam], (err, results) => {
        if (err) {
            console.error("❌ SQL 查詢錯誤:", err);
            return res.status(500).json({ error: "資料庫查詢失敗，請稍後重試！" });
        }

        if (results.length === 0) {
            return res.redirect('/index'); // 若查無資料，回首頁
        }

        console.log("✅ 渲染 analysis.ejs，傳遞資料:", results[0]);

        res.render("analysis", {
            analysisData: results,
            userId: queryParam, // ✅ 確保傳遞正確的 ID
            user_name: results[0].name, // ✅ `user_name` 統一為 `name`
            table // ✅ 傳遞 table，讓 EJS 知道是 users 或 man_users
        });
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
    const { user_id, man_user_id, action, ip_address, user_agent, details } = req.body;

    // 確認管理員 ID 是否有效
    connection.query('SELECT 1 FROM man_user WHERE user_id = ?', [man_user_id], (err, results) => {
        if (err) {
            console.error('Error checking manager existence:', err);
            res.status(500).send(`Error verifying manager: ${err.message}`);
            return;
        }

        if (results.length === 0) {
            res.status(400).send('Invalid manager user ID');
            return;
        }

        // 插入活動日誌
        const query = `
            INSERT INTO user_activity_logs (user_id, man_user_id, action, ip_address, user_agent, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        connection.query(query, [user_id, man_user_id, action, ip_address, user_agent, details], (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send(`Error saving data: ${err.message}`);
                return;
            }
            res.send('Log entry added successfully');
        });
    });
});



// 更新活動日誌資料
app.put('/user_activity_logs/:log_id', (req, res) => {
    const logId = req.params.log_id;
    const { user_id, man_user_id, action, ip_address, user_agent, details } = req.body;

    const query = `
        UPDATE user_activity_logs
        SET user_id = ?, man_user_id = ?, action = ?, ip_address = ?, user_agent = ?, details = ?
        WHERE log_id = ?
    `;

    connection.query(query, [user_id, man_user_id, action, ip_address, user_agent, details, logId], (err, result) => {
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


app.post('/settings', authenticateRole('管理者'), (req, res) => {
    const { employee_name, employee_role, settings_id } = req.body;
    const defaultPassword = '123456';

    if (!settings_id) {
        return res.status(400).send("❌ 缺少 settings_id，請提供！");
    }

    const query = `
        INSERT INTO settings (settings_id, employee_name, employee_password, employee_role, password_reset_required)
        VALUES (?, ?, ?, ?, TRUE)
    `;

    connection.query(query, [settings_id, employee_name, defaultPassword, employee_role], (err) => {
        if (err) {
            console.error('❌ 新增員工失敗:', err);
            return res.status(500).send('新增失敗，請稍後重試！');
        }
        res.send('✅ 員工新增成功，請重設密碼');
    });
});

// 📌 登入路由（確保 settings_id 正確傳遞）
app.post('/settings/login', (req, res) => {
    const { employee_name, employee_password } = req.body;

    const query = `
        SELECT settings_id, employee_role, password_reset_required, account_status
        FROM settings 
        WHERE employee_name = ? AND employee_password = ?
    `;

    connection.query(query, [employee_name, employee_password], (err, results) => {
        if (err) {
            console.error('❌ 登入錯誤:', err);
            return res.status(500).render('settings', { loginError: '登入失敗，請稍後重試！', userRole: null });
        }

        if (results.length === 0) {
            console.warn('⚠️ 帳號或密碼錯誤');
            return res.status(403).render('settings', { loginError: '帳號或密碼錯誤', userRole: null });
        }

        const user = results[0];

        // ✅ 檢查是否凍結
        if (user.account_status === '凍結') {
            console.warn(`⚠️ 嘗試使用凍結帳戶登入: ${employee_name}`);
            return res.status(403).render('settings', {
                loginError: '❌ 此帳號已停止使用，請聯繫管理員！',
                userRole: null
            });
        }

        // ✅ 設置 Session
        req.session.userRole = user.employee_role;
        req.session.settingsId = user.settings_id;

        console.log(`✅ 登入成功: 角色 - ${user.employee_role}, settings_id - ${user.settings_id}`);

        res.render('settings', {
            userRole: user.employee_role,
            settingsId: user.settings_id,
            passwordResetRequired: user.password_reset_required
            
        });
    });
});


app.put('/settings/:settings_id', (req, res) => {
    const { settings_id } = req.params;
    const { employee_name, employee_password, employee_role } = req.body;

    if (req.session.userRole !== '管理者') {
        return res.status(403).send('您沒有權限更新員工資料');
    }

    const query = `UPDATE settings SET employee_name = ?, employee_password = ?, employee_role = ? WHERE settings_id = ?`;

    connection.query(query, [employee_name, employee_password, employee_role, settings_id], (err) => {
        if (err) {
            console.error('更新員工失敗:', err);
            return res.status(500).send('更新失敗，請稍後重試！');
        }

        res.status(200).send('員工資料成功更新');
    });
});

app.delete('/settings/:settings_id', (req, res) => {
    const { settings_id } = req.params;

    if (req.session.userRole !== '管理者') {
        return res.status(403).send('您沒有權限刪除員工');
    }

    const query = `DELETE FROM settings WHERE settings_id = ?`;

    connection.query(query, [settings_id], (err) => {
        if (err) {
            console.error('刪除員工失敗:', err);
            return res.status(500).send('刪除失敗，請稍後重試！');
        }

        res.status(200).send('員工成功刪除');
    });
});


// 📌 Dashboard 頁面
app.get('/dashboard', (req, res) => {
    if (req.query.settings_id) {
        req.session.settingsId = parseInt(req.query.settings_id, 10);
    }
    
    const settingsId = req.session.settingsId || null; 
    const userRole = req.session.userRole || req.query.user_role || "訪客";

    const query = `SELECT * FROM settings`;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('❌ 讀取員工錯誤:', err);
            return res.status(500).render('error', { message: "無法獲取員工列表，請稍後重試！" });
        }

        console.log("✅ settings 資料查詢成功，員工數:", results.length);

        res.render('dashboard', {
            userRole,
            employees: results,  
            employee: settingsId ? results.find(emp => emp.settings_id === settingsId) || {} : {} 
        });
    });
});


app.get('/dashboard/view-all', (req, res) => {
    console.log('訪問 dashboard/view-all 以獲取所有員工資料');

    const query = `SELECT settings_id, employee_name, role FROM dashboard`;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('查詢所有員工資料失敗:', err);
            return res.status(500).json({ message: '無法獲取資料，請稍後重試！' });
        }

        res.status(200).json({ employees: results });
    });
});
app.get('/dashboard/:dashboard_id', (req, res) => {
    const dashboardId = req.params.dashboard_id;
    console.log(`訪問 dashboard/${dashboardId} 以獲取特定員工`);

    const query = 'SELECT * FROM dashboard WHERE dashboard_id = ?';
    connection.query(query, [dashboardId], (err, results) => {
        if (err) {
            console.error('SQL查詢錯誤:', err);
            return res.status(500).send(`查詢失敗: ${err.message}`);
        }

        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('找不到該員工');
        }
    });
});

app.post('/dashboard', (req, res) => {
    const { settings_id, employee_name, role } = req.body;

    if (req.session.userRole !== '管理者') {
        return res.status(403).send('您沒有權限新增資料');
    }

    const query = `INSERT INTO dashboard (settings_id, employee_name, role) VALUES (?, ?, ?)`;

    connection.query(query, [settings_id, employee_name, role], (err) => {
        if (err) {
            console.error('新增資料失敗:', err);
            return res.status(500).send('新增失敗，請稍後重試！');
        }

        res.status(200).send('資料新增成功');
    });
});

// 🔹新增員工
app.post('/dashboard/add', authenticateRole('管理者'), (req, res) => {
    const { employee_name, employee_role } = req.body;
    const defaultPassword = '123456';

    if (!employee_name || !employee_role) {
        return res.status(400).send("錯誤：員工姓名和角色必須提供！");
    }

    const checkQuery = `SELECT COUNT(*) AS count FROM settings WHERE employee_name = ?`;
    connection.query(checkQuery, [employee_name], (err, results) => {
        if (err) return res.status(500).send('系統錯誤，請稍後重試！');
        if (results[0].count > 0) return res.status(400).send(`⚠️ 員工名稱 '${employee_name}' 已存在！`);

        const insertQuery = `
            INSERT INTO settings (employee_name, employee_password, employee_role, password_reset_required)
            VALUES (?, ?, ?, TRUE)
        `;

        connection.query(insertQuery, [employee_name, defaultPassword, employee_role], (err, result) => {
            if (err) return res.status(500).send('新增失敗，請稍後重試！');

            console.log(`✅ 員工新增成功，ID: ${result.insertId}`);
            res.redirect(`/dashboard?settings_id=${req.session.settingsId}`);
        });
    });
});

// 🔹修改員工
app.post('/dashboard/edit', authenticateRole(['管理者', '研究人員修改者', '臨床人員修改者']), (req, res) => {
    const { settings_id, employee_role } = req.body;

    if (!settings_id || !employee_role) {
        return res.status(400).render('dashboard', {
            userRole: req.session.userRole || "訪客",
            employees: [],
            errorMessage: "❌ 無效的修改請求！"
        });
    }

    const validRoles = ["管理者", "研究人員修改者", "臨床人員修改者", "檢視者"];
    if (!validRoles.includes(employee_role)) {
        return res.status(400).render('dashboard', {
            userRole: req.session.userRole || "訪客",
            employees: [],
            errorMessage: "❌ 角色不正確！"
        });
    }

    const updateQuery = `UPDATE settings SET employee_role = ? WHERE settings_id = ?`;
    connection.query(updateQuery, [employee_role, settings_id], (err) => {
        if (err) return res.status(500).render('dashboard', { errorMessage: "❌ 修改失敗，請稍後重試！" });

        console.log(`✅ 修改成功，員工 ID: ${settings_id}，變更為: ${employee_role}`);
        res.redirect(`/dashboard?settings_id=${req.session.settingsId}`);
    });
});




// 🔹凍結員工
app.post('/dashboard/freeze', authenticateRole('管理者'), (req, res) => {
    const { settings_id } = req.body;

    if (!settings_id) {
        return res.status(400).send("錯誤：請提供 settings_id！");
    }

    const freezeQuery = `UPDATE settings SET account_status = '凍結' WHERE settings_id = ?`;
    connection.query(freezeQuery, [settings_id], (err) => {
        if (err) return res.status(500).send('凍結失敗，請稍後重試！');

        console.log(`✅ 員工 ID: ${settings_id} 已凍結`);
        res.redirect(`/dashboard?settings_id=${req.session.settingsId}`);
    });
});



app.post('/dashboard/reset_password', (req, res) => {
    const { settings_id } = req.body;

    const query = `
        UPDATE settings SET password_reset_required = TRUE WHERE settings_id = ?
    `;

    connection.query(query, [settings_id], (err) => {
        if (err) {
            console.error('❌ 設定密碼重設錯誤:', err);
            return res.status(500).send('設置失敗，請稍後重試！');
        }
        res.redirect('/dashboard');
    });
});

app.put('/dashboard/:dashboard_id', (req, res) => {
    const { dashboard_id } = req.params;
    const { employee_name, role } = req.body;

    if (req.session.userRole === '檢視者') {
        return res.status(403).send('您沒有權限修改資料');
    }

    const query = `UPDATE dashboard SET employee_name = ?, role = ? WHERE dashboard_id = ?`;

    connection.query(query, [employee_name, role, dashboard_id], (err) => {
        if (err) {
            console.error('更新資料失敗:', err);
            return res.status(500).send('更新失敗，請稍後重試！');
        }

        res.status(200).send('資料成功更新');
    });
});

app.delete('/dashboard/:dashboard_id', (req, res) => {
    const { dashboard_id } = req.params;

    if (req.session.userRole !== '管理者') {
        return res.status(403).send('您沒有權限刪除資料');
    }

    const query = `DELETE FROM dashboard WHERE dashboard_id = ?`;

    connection.query(query, [dashboard_id], (err) => {
        if (err) {
            console.error('刪除資料失敗:', err);
            return res.status(500).send('刪除失敗，請稍後重試！');
        }

        res.status(200).send('資料成功刪除');
    });
});

app.post('/reset_password', (req, res) => {
    const { settings_id, new_password } = req.body;

    const query = `
        UPDATE settings SET employee_password = ?, password_reset_required = FALSE WHERE settings_id = ?
    `;

    connection.query(query, [new_password, settings_id], (err, result) => {
        if (err) {
            console.error('❌ 密碼重設錯誤:', err);
            return res.status(500).send(`Error: ${err.message}`);
        }
        res.redirect(`/dashboard?settings_id=${settings_id}`);
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('登出錯誤:', err);
            return res.status(500).send('登出失敗！');
        }
        res.redirect('/settings'); // 或者重定向到首頁
    });
});

app.post('/login', (req, res) => {
    const { employee_name, employee_password } = req.body;

    const query = `SELECT * FROM settings WHERE employee_name = ? AND employee_password = ? AND account_status != '凍結'`;
    connection.query(query, [employee_name, employee_password], (err, results) => {
        if (err) {
            console.error('登入查詢錯誤:', err);
            return res.status(500).send('資料庫查詢失敗！');
        }

        if (results.length === 0) {
            return res.status(400).send('帳號或密碼錯誤，或帳號已凍結！');
        }

        const user = results[0];

        // ✅ 檢查是否已凍結
        if (user.account_status === '凍結') {
            return res.status(403).send("❌ 此帳號已停止使用，請聯繫管理員！");
        }

        // ✅ 設置 Session
        req.session.settings_id = user.settings_id;
        req.session.userRole = user.employee_role;

        console.log("✅ 登入成功，User ID:", req.session.settings_id);

        res.redirect('/dashboard');
    });
});
  
app.listen(port, '0.0.0.0' , () => {
    console.log(`Server is running on port ${port}`);
});
