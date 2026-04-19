document.addEventListener('DOMContentLoaded', async () => {
    
    const token = await requireAuthenticatedPage();
    if (!token) {
        return;
    }

    DataModel.setToken(token);
    displayWelcomeMessage();
    displayOldAccountAlert();
    
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
    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error('Error logging out:', error);
        }

        localStorage.removeItem('jwtToken');
        window.location.replace('/');
    });

    async function displayWelcomeMessage() {

        const userName = await DataModel.getUserName();
        welcomeHeading.textContent = `Welcome to GymRat, ${userName}!`;
    }

    async function displayOldAccountAlert() {
        const alertElement = document.getElementById('oldAccountAlert');

        try {
            const res = await fetch('/api/user-profile-status', {
                headers: {
                    "Authorization": token
                }
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('Error checking profile status:', data.message);
                return;
            }

            alertElement.style.display = data.hasProfile ? 'none' : 'block';
        } catch (error) {
            console.error('Error checking profile status:', error);
        }
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

    // Fetch active days this month
    async function activeDaysThisMonth() {
        const token = localStorage.getItem("jwtToken");

        try {
            const res = await fetch('/api/active-days-this-month', {
                headers: {
                    "Authorization": token
                }
            });

            const data = await res.json();
            document.getElementById('activeDaysMonth').textContent = data.total;
        } catch (error) {
            console.error('Error fetching active days this month:', error);
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
        const weight = Number(profile.weight) || 120; // lbs
        const height = Number(profile.height) || 65;  // inches
        const age = Number(profile.age) || 20;
        const gender = (profile.gender || "female").toLowerCase();

        let bmr = 0;

        if (gender === "male") {
            bmr = 66 + (6.23 * weight) + (12.7 * height) - (6.8 * age);
        } else {
            bmr = 655 + (4.35 * weight) + (4.7 * height) - (4.7 * age);
        }

        return Math.round(bmr);
    }

async function getTargetCalories() {
    try {
        const profile = await DataModel.getUserProfile();
        console.log("PROFILE FROM BASEPAGE:", profile);

        const weightLbs = Number(profile.weight) || 120;
        const heightInches = Number(profile.height) || 65;
        const age = Number(profile.age) || 20;

        const gender = (profile.gender || "").toLowerCase().trim();
        const goal = (profile.fitness_goal || "").toLowerCase().trim();
        const exerciseLevel = (profile.exercise_level || "").toLowerCase().trim();

        let bmr = 0;

        if (gender === "male") {
            bmr = 66 + (6.23 * weightLbs) + (12.7 * heightInches) - (6.8 * age);
        } else {
            bmr = 655 + (4.35 * weightLbs) + (4.7 * heightInches) - (4.7 * age);
        }

        let activityMultiplier = 1.2;

        if (exerciseLevel === "low") {
            activityMultiplier = 1.2;
        } else if (exerciseLevel === "moderate") {
            activityMultiplier = 1.375;
        } else if (exerciseLevel === "high") {
            activityMultiplier = 1.55;
        }

        const maintenanceCalories = Math.round(bmr * activityMultiplier);

        if (goal === "lose weight" || goal === "lose_weight") {
            return maintenanceCalories - 300;
        }

        if (goal === "build muscle" || goal === "build_muscle") {
            return maintenanceCalories + 250;
        }

        if (goal === "gain weight" || goal === "gain_weight") {
            return maintenanceCalories + 300;
        }

        if (goal === "maintain weight" || goal === "maintain_weight") {
            return maintenanceCalories;
        }

        return maintenanceCalories;
    } catch (error) {
        console.error("Error fetching target calories:", error);
        return 2000;
    }
}

    // Update Progress Toward Goal and Daily Net Calories
    async function updateGoalProgress() {
        try {
            const consumed = await caloriesConsumedToday();
            const goal = await getTargetCalories();

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
    activeDaysThisMonth();
    updateGoalProgress();
    // Fetch the user's name and display a welcome message based on username and span id welcomeMessage
    

    //////////////////////////////////////////
    //END EVENT LISTENERS
    //////////////////////////////////////////
});
