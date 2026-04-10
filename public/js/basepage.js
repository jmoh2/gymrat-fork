document.addEventListener('DOMContentLoaded', () => {
    
    const token = localStorage.getItem('jwtToken');
        if (!token) {
            window.location.href = '/';
        } else {
            DataModel.setToken(token);
            displayWelcomeMessage();
        }
    
    //////////////////////////////////////////
    //ELEMENTS TO ATTACH EVENT LISTENERS
    //////////////////////////////////////////
    const logoutButton = document.getElementById('logoutButton');
    const welcomeHeading = document.getElementById('welcomeHeading');

    //////////////////////////////////////////
    //END ELEMENTS TO ATTACH EVENT LISTENERS
    //////////////////////////////////////////


    //////////////////////////////////////////
    //EVENT LISTENERS
    //////////////////////////////////////////
    // Log out and redirect to login
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/';
    });

    async function displayWelcomeMessage() {

        const userName = await DataModel.getUserName();
        welcomeHeading.textContent = `Welcome to GymRat, ${userName}!`;
    }

    // Fetch and display total workout count
    async function totalWorkoutCount() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/workout-count', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();
            document.getElementById('workoutCount').textContent = data.total;
        } catch (error) {
            console.error('Error fetching workout count:', error);
        }
    }

    // Fetch and display total meal count
    async function totalMealCount() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/meal-count', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();
            document.getElementById('mealCount').textContent = data.total;
        } catch (error) {
            console.error('Error fetching meal count:', error);
        }
    }   

    // Fetch and display Calories burned today
    async function caloriesBurnedToday() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/calories-burned-today', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();
            document.getElementById('calorieSummary').textContent = data.total;
        } catch (error) {
            console.error('Error fetching calories burned today:', error);
        }
    }

    // Fetch and display active days this week
    async function activeDaysThisWeek() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/active-days-this-week', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();
            document.getElementById('activeDaysSummary').textContent = data.total;
        } catch (error) {
            console.error('Error fetching active days this week:', error);
        }
    }   

        // Fetch calories consumed today
    async function caloriesConsumedToday() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/calories-consumed-today', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();
            return Number(data.total) || 0;
        } catch (error) {
            console.error('Error fetching calories consumed today:', error);
            return 0;
        }
    }

    // Calculate BMR using lbs and inches
    function calculateBMR(profile) {
        if (!profile) {
            return 2000;
        }

        const weightLbs = Number(profile.weight) || 120;
        const heightInches = Number(profile.height) || 65;
        const age = Number(profile.age) || 20;
        const gender = (profile.gender || "female").toLowerCase();

        const weightKg = weightLbs * 0.453592;
        const heightCm = heightInches * 2.54;

        let bmr = 0;

        if (gender === "male") {
            bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
        } else {
            bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
        }

        return Math.round(bmr);
    }

    // Get calorie goal based on profile goal
    async function getTargetCalories() {
        try {
            const profile = await DataModel.getUserProfile();
            const bmr = calculateBMR(profile);
            const goal = profile.fitness_goal;

            if (goal === "lose_weight" || goal === "Lose Weight") {
                return bmr - 300;
            }

            if (goal === "gain_muscle" || goal === "Gain Muscle") {
                return bmr + 300;
            }

            return bmr;
        } catch (error) {
            console.error('Error fetching target calories:', error);
            return 2000;
        }
    }

    // Update Progress Toward Goal and Daily Net Calories
    async function updateGoalProgress() {
        try {
            const consumed = await caloriesConsumedToday();

            const token = localStorage.getItem("jwtToken");
            let burned = 0;

            try {
                const res = await fetch('/api/calories-burned-today', {
                    headers: {
                        "Authorization": token
                    }
                });
                const data = await res.json();
                burned = Number(data.total) || 0;
            } catch (error) {
                console.error('Error fetching calories burned for goal progress:', error);
            }

            const goal = await getTargetCalories();

            const netCalories = consumed - burned;
            const percent = Math.min((consumed / goal) * 100, 100);
            const remaining = Math.max(goal - consumed, 0);

            document.getElementById("netCaloriesValue").textContent = netCalories + " cal";
            document.getElementById("consumedText").textContent = "Consumed: " + consumed;
            document.getElementById("burnedText").textContent = "Burned: " + burned;

            document.getElementById("goalPercentText").textContent = Math.round(percent) + "% of goal";
            document.getElementById("goalCaloriesText").textContent = consumed + " / " + goal + " calories";
            document.getElementById("goalRemainingText").textContent = remaining + " calories remaining";

            document.getElementById("progressBar").style.width = percent + "%";
        } catch (error) {
            console.error('Error updating goal progress:', error);
        }
    }

    totalWorkoutCount();
    totalMealCount();
    caloriesBurnedToday();
    activeDaysThisWeek();
    updateGoalProgress();
    // Fetch the user's name and display a welcome message based on username and span id welcomeMessage
    

    //////////////////////////////////////////
    //END EVENT LISTENERS
    //////////////////////////////////////////
});