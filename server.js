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

function getLocalDateForSql() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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
    const { date, type, description, calories, protein, fats, carbs, favorite } = req.body;

    if (
        !date ||
        !type ||
        !description ||
        calories === undefined ||
        protein === undefined ||
        fats === undefined ||
        carbs === undefined
    ) {
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
             (user_id, meal_date, meal_type, description, calories, protein, fats, carbs, favorite_flag)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, date, type, description, calories, protein, fats, carbs, favorite ? 1 : 0]
        );
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
     const { workoutName, workoutType, workoutIntensity, duration, notes, date, caloriesBurned, favorite } = req.body;

    if (
        !workoutName ||
        !workoutType ||
        !workoutIntensity ||
        !duration ||
        !date ||
        caloriesBurned === undefined
    ) {
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
             (user_id, workout_name, workout_type, intensity_level, duration_minutes, notes, workout_date, calories_burned, favorite_flag)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, workoutName, workoutType, workoutIntensity, duration, notes || null, date, caloriesBurned, favorite ? 1 : 0]
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
            `SELECT workout_id, workout_date, workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes, favorite_flag
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

// Route: Get User Favorite Workouts
app.get('/api/workouts/favorites', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT workout_id, workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes
             FROM workouts
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             AND favorite_flag = 1
             ORDER BY workout_name ASC, workout_id DESC`,
            [req.user.email]
        );
        await connection.end();

        res.status(200).json({ favorites: rows });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving favorite workouts.' });
    }
});

// Route: Log a favorite workout using today's local date
app.post('/api/workouts/favorites/:workoutId/log', authenticateToken, async (req, res) => {
    const { workoutId } = req.params;

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

        const [favoriteRows] = await connection.execute(
            `SELECT workout_name, workout_type, intensity_level, duration_minutes, calories_burned, notes
             FROM workouts
             WHERE workout_id = ? AND user_id = ? AND favorite_flag = 1`,
            [workoutId, userId]
        );

        if (favoriteRows.length === 0) {
            return res.status(404).json({ message: 'Favorite workout not found.' });
        }

        const favoriteWorkout = favoriteRows[0];
        const today = getLocalDateForSql();

        await connection.execute(
            `INSERT INTO workouts
             (user_id, workout_name, workout_type, intensity_level, duration_minutes, notes, workout_date, calories_burned, favorite_flag)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                favoriteWorkout.workout_name,
                favoriteWorkout.workout_type,
                favoriteWorkout.intensity_level,
                favoriteWorkout.duration_minutes,
                favoriteWorkout.notes,
                today,
                favoriteWorkout.calories_burned,
                0
            ]
        );

        res.status(201).json({ message: 'Favorite workout logged successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error logging favorite workout.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Delete a user workout
app.delete('/api/workouts/:workoutId', authenticateToken, async (req, res) => {
    const { workoutId } = req.params;

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

        const [deleteResult] = await connection.execute(
            'DELETE FROM workouts WHERE workout_id = ? AND user_id = ?',
            [workoutId, userId]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Workout not found.' });
        }

        res.status(200).json({ message: 'Workout deleted successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error deleting workout.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Remove a workout from favorites
app.patch('/api/workouts/:workoutId/favorite', authenticateToken, async (req, res) => {
    const { workoutId } = req.params;

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

        const [updateResult] = await connection.execute(
            'UPDATE workouts SET favorite_flag = 0 WHERE workout_id = ? AND user_id = ?',
            [workoutId, userId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Workout not found.' });
        }

        res.status(200).json({ message: 'Workout removed from favorites!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error updating workout favorite.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Add a workout to favorites
app.patch('/api/workouts/:workoutId/favorite/add', authenticateToken, async (req, res) => {
    const { workoutId } = req.params;

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

        const [updateResult] = await connection.execute(
            'UPDATE workouts SET favorite_flag = 1 WHERE workout_id = ? AND user_id = ?',
            [workoutId, userId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Workout not found.' });
        }

        res.status(200).json({ message: 'Workout added to favorites!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error updating workout favorite.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Get User Meals
app.get('/api/meals', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT meal_id, meal_date, meal_type, description, calories, protein, fats, carbs, favorite_flag
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

// Route: Get User Favorite Meals
app.get('/api/meals/favorites', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT meal_id, meal_type, description, calories, protein, fats, carbs
             FROM meals
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             AND favorite_flag = 1
             ORDER BY description ASC, meal_id DESC`,
            [req.user.email]
        );
        await connection.end();

        res.status(200).json({ favorites: rows });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving favorite meals.' });
    }
});

// Route: Log a favorite meal using today's local date
app.post('/api/meals/favorites/:mealId/log', authenticateToken, async (req, res) => {
    const { mealId } = req.params;

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

        const [favoriteRows] = await connection.execute(
            `SELECT meal_type, description, calories, protein, fats, carbs
             FROM meals
             WHERE meal_id = ? AND user_id = ? AND favorite_flag = 1`,
            [mealId, userId]
        );

        if (favoriteRows.length === 0) {
            return res.status(404).json({ message: 'Favorite meal not found.' });
        }

        const favoriteMeal = favoriteRows[0];
        const today = getLocalDateForSql();

        await connection.execute(
            `INSERT INTO meals
             (user_id, meal_date, meal_type, description, calories, protein, fats, carbs, favorite_flag)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                today,
                favoriteMeal.meal_type,
                favoriteMeal.description,
                favoriteMeal.calories,
                favoriteMeal.protein,
                favoriteMeal.fats,
                favoriteMeal.carbs,
                0
            ]
        );

        res.status(201).json({ message: 'Favorite meal logged successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error logging favorite meal.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Delete a user meal
app.delete('/api/meals/:mealId', authenticateToken, async (req, res) => {
    const { mealId } = req.params;

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

        const [deleteResult] = await connection.execute(
            'DELETE FROM meals WHERE meal_id = ? AND user_id = ?',
            [mealId, userId]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Meal not found.' });
        }

        res.status(200).json({ message: 'Meal deleted successfully!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error deleting meal.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Remove a meal from favorites
app.patch('/api/meals/:mealId/favorite', authenticateToken, async (req, res) => {
    const { mealId } = req.params;

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

        const [updateResult] = await connection.execute(
            'UPDATE meals SET favorite_flag = 0 WHERE meal_id = ? AND user_id = ?',
            [mealId, userId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Meal not found.' });
        }

        res.status(200).json({ message: 'Meal removed from favorites!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error updating meal favorite.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Route: Add a meal to favorites
app.patch('/api/meals/:mealId/favorite/add', authenticateToken, async (req, res) => {
    const { mealId } = req.params;

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

        const [updateResult] = await connection.execute(
            'UPDATE meals SET favorite_flag = 1 WHERE meal_id = ? AND user_id = ?',
            [mealId, userId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Meal not found.' });
        }

        res.status(200).json({ message: 'Meal added to favorites!' });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error updating meal favorite.' });
    } finally {
        if (connection) {
            await connection.end();
        }
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

// Route: Get Calories Burned Today
app.get('/api/calories-burned-today', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const today = new Date().toISOString().split('T')[0];

        const [result] = await connection.execute(
            `SELECT SUM(calories_burned) AS total_calories
             FROM workouts
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             AND workout_date = ?`,
            [req.user.email, today]
        );
        await connection.end();

        const caloriesBurned = result[0].total_calories || 0;
        res.status(200).json({ total: caloriesBurned });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving calories burned today.' });
    }
}); 

// Route: Get Active Days This Week
app.get('/api/active-days-this-week', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)).toISOString().split('T')[0];

        const [result] = await connection.execute(
            `SELECT COUNT(DISTINCT workout_date) AS active_days
             FROM workouts
             WHERE user_id = (SELECT user_id FROM user WHERE email = ?)
             AND workout_date BETWEEN ? AND ?`,
            [req.user.email, startOfWeek, endOfWeek]
        );
        await connection.end();

        const activeDays = result[0].active_days || 0;
        res.status(200).json({ total: activeDays });
    } catch (error) {
        console.error('DB ERROR:', error);
        res.status(500).json({ message: 'Error retrieving active days this week.' });
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

        const today = getLocalDateForSql();

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

        const today = getLocalDateForSql();

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
