require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the "public" folder
app.use(express.static('public'));

//////////////////////////////////////
//ROUTES TO SERVE HTML FILES
//////////////////////////////////////
// Default route to serve logon.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/logon.html');
});

// Route to serve dashboard.html
app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

// Route to serve basepage.html
app.get('/basepage', (req, res) => {
    res.sendFile(__dirname + '/public/basepage.html');
});
//////////////////////////////////////
//END ROUTES TO SERVE HTML FILES
//////////////////////////////////////


/////////////////////////////////////////////////
//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// **Authorization Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();

            // Query the database to verify that the email is associated with an active account
            const [rows] = await connection.execute(
                'SELECT email FROM user WHERE email = ?',
                [decoded.email]
            );

            await connection.end();  // Close connection

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;  // Save the decoded email for use in the route
            next();  // Proceed to the next middleware or route handler
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
    
}
/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////


//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const {
        email,
        password,
        gender,
        height,
        weight,
        age,
        fitness_goal,
        exercise_level
    } = req.body;

    if (
        !email ||
        !password ||
        !gender ||
        !height ||
        !weight ||
        !age ||
        !fitness_goal ||
        !exercise_level
    ) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    let connection;

    try {
        connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);

        await connection.beginTransaction();

        const [userResult] = await connection.execute(
            'INSERT INTO user (email, password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        const userId = userResult.insertId;

        await connection.execute(
            `INSERT INTO user_profile
            (user_id, height, weight, gender, age, fitness_goal, exercise_level)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, height, weight, gender, age, fitness_goal, exercise_level]
        );

        await connection.commit();
        await connection.end();

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            await connection.end();
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        console.error(error);
        res.status(500).json({ message: 'Error creating account.' });
    }
});

// Route: Logon
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE email = ?',
            [email]
        );

        await connection.end();  // Close connection

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Send meal data (Protected Route)
app.post('/api/meals', authenticateToken, async (req, res) => {
    const { date, type, description, calories, protein, fats, carbs } = req.body;

    if (!date || !type || !description || !calories || !protein || !fats || !carbs) {
        return res.status(400).json({ message: 'All meal fields are required.' });
    }

    let connection;
    try {
        connection = await createConnection();
        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const userId = userRows[0].user_id;

        await connection.execute(
            `INSERT INTO meals
             (user_id, meal_date, meal_type, description, calories, protein, fats, carbs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, date, type, description, calories, protein, fats, carbs]
        );
        await connection.end();
        res.status(201).json({ message: 'Meal data saved successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error saving meal data.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Send Workout Data (Protected Route)
app.post('/api/workouts', authenticateToken, async (req, res) => {
     const { workoutName, workoutType, workoutIntensity, duration, notes, date, caloriesBurned } = req.body;

    if (!workoutName || !workoutType || !workoutIntensity || !duration || !date || !caloriesBurned) {
        return res.status(400).json({ message: 'All workout fields except notes are required.' });
    }

    let connection;

    try {
        connection = await createConnection();

        console.log('Token user:', req.user);

        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );

        console.log('User lookup result:', userRows);

        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const userId = userRows[0].user_id;

        const [insertResult] = await connection.execute(
            `INSERT INTO workouts
             (user_id, workout_name, workout_type, intensity_level, duration_minutes, notes, workout_date, calories_burned)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, workoutName, workoutType, workoutIntensity, duration, notes || null, date, caloriesBurned]
        );

        console.log('Insert result:', insertResult);

        res.status(201).json({ message: 'Workout data saved successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error saving workout data.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Get All Email Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT email FROM user');

        await connection.end();  // Close connection

        const emailList = rows.map((row) => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email addresses.' });
    }
});

// Route: Get User Name (for basepage welcome message)
app.get('/api/user-name', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT email FROM user WHERE email = ?', [req.user.email]);

        await connection.end();  // Close connection

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const userName = rows[0].email.split('@')[0];  // Extract name before '@' symbol
        res.status(200).json({ name: userName });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving user name.' });
    }
});
/// Route: Get User Profile
app.get('/api/user-profile', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            'SELECT gender, age, height, weight, fitness_goal, exercise_level FROM user_profile WHERE user_id = (SELECT user_id FROM user WHERE email = ?)',
            [req.user.email]
        );
        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving profile.' });
    }
});


// Route: Update User Profile
app.put('/api/user-profile', authenticateToken, async (req, res) => {
    const { gender, age, height, weight, fitness_goal, exercise_level} = req.body;

    if ( !gender || !age || !height || !weight || !fitness_goal || !exercise_level) {
        return res.status(400).json({ message: 'Height, weight, fitness goal, and exercise level are required.' });
    }

    try {
        const connection = await createConnection();
        await connection.execute(
            'UPDATE user_profile SET gender = ?, age = ?, height = ?, weight = ?, fitness_goal = ?, exercise_level = ? WHERE user_id = (SELECT user_id FROM user WHERE email = ?)',
            [gender, age, height, weight, fitness_goal, exercise_level, req.user.email]
        );
        await connection.end();

        res.status(200).json({ message: 'Profile updated successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error updating profile.' });
    }
});

// Route: Get User Workouts
app.get('/api/workouts', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT workout_date, workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes
             FROM workouts
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             ORDER BY workout_date DESC`,
            [req.user.email]
        );
        await connection.end();

        res.status(200).json({ workouts: rows });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving workouts.' });
    }
});

// Route: Get User Meals
app.get('/api/meals', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT meal_date, meal_type, description, calories, protein, fats, carbs
             FROM meals
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             ORDER BY meal_date DESC`,
            [req.user.email]
        );
        await connection.end();

        res.status(200).json({ meals: rows });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving meals.' });
    }
});

// Route: Total Number of Workouts Logged
app.get('/api/workout-count', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [result] = await connection.execute(
            `SELECT COUNT(*) AS total_workouts
             FROM workouts
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)`,
            [req.user.email]
        );
        await connection.end();

        const workoutCount = result[0].total_workouts || 0;
        res.status(200).json({ total: workoutCount });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving workout count.' });
    }
});

// Route: Total Number of Meals Logged
app.get('/api/meal-count', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [result] = await connection.execute(
            `SELECT COUNT(*) AS total_meals
             FROM meals
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)`,
            [req.user.email]
        );
        await connection.end();

        const mealCount = result[0].total_meals || 0;
        res.status(200).json({ total: mealCount });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving meal count.' });
    }
});

// Route: Get Suggested Workout based on user's fitness goal
app.get('/api/suggested-workout', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        // Get user's fitness goal
        const [profileRows] = await connection.execute(
            'SELECT fitness_goal FROM user_profile WHERE user_id = (SELECT user_id FROM user WHERE email = ?)',
            [req.user.email]
        );

        if (profileRows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Profile not found.' });
        }

        const fitnessGoal = profileRows[0].fitness_goal;

        // Get a random suggested workout matching the user's goal
        const [workoutRows] = await connection.execute(
    'SELECT * FROM workout_suggestions WHERE fitness_goal = ? ORDER BY RAND() LIMIT 1',
    [fitnessGoal]
    );

        await connection.end();

        if (workoutRows.length === 0) {
            return res.status(404).json({ message: 'No suggested workout found.' });
        }

        res.status(200).json(workoutRows[0]);
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving suggested workout.' });
    }
});

// Route: Log a suggested workout
// Route: Log a suggested workout
app.post('/api/log-suggested-workout', authenticateToken, async (req, res) => {
    const { workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes } = req.body;

    try {
        const connection = await createConnection();

        const today = new Date().toISOString().split('T')[0];

        await connection.execute(
            `INSERT INTO workouts (user_id, workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes, workout_date)
             VALUES ((SELECT user_id FROM user WHERE email = ?), ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.email, workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes, today]
        );

        await connection.end();
        res.status(201).json({ message: 'Workout logged successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error logging workout.' });
    }
});

// Route: Get Suggested Meal based on user's fitness goal
app.get('/api/suggested-meal', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [profileRows] = await connection.execute(
            'SELECT fitness_goal FROM user_profile WHERE user_id = (SELECT user_id FROM user WHERE email = ?)',
            [req.user.email]
        );

        if (profileRows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Profile not found.' });
        }

        const fitnessGoal = profileRows[0].fitness_goal;

        const [mealRows] = await connection.execute(
            'SELECT * FROM meal_suggestions WHERE linked_goal = ? ORDER BY RAND() LIMIT 1',
            [fitnessGoal]
        );

        await connection.end();

        if (mealRows.length === 0) {
            return res.status(404).json({ message: 'No suggested meal found.' });
        }

        res.status(200).json(mealRows[0]);
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving suggested meal.' });
    }
});

// Route: Log a suggested meal
app.post('/api/log-suggested-meal', authenticateToken, async (req, res) => {
    const { meal_title, description, calories, protein, fats, carbs } = req.body;

    try {
        const connection = await createConnection();

        const today = new Date().toISOString().split('T')[0];

        await connection.execute(
            `INSERT INTO meals (user_id, meal_date, meal_type, description, calories, protein, fats, carbs)
             VALUES ((SELECT user_id FROM user WHERE email = ?), ?, 'suggestion', ?, ?, ?, ?, ?)`,
            [req.user.email, today, description || meal_title, calories, protein, fats, carbs]
        );

        await connection.end();
        res.status(201).json({ message: 'Meal logged successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error logging meal.' });
    }
});
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});