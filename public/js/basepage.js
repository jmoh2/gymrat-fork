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
    totalWorkoutCount();
    totalMealCount();
    caloriesBurnedToday();
    activeDaysThisWeek();
    // Fetch the user's name and display a welcome message based on username and span id welcomeMessage
    

    //////////////////////////////////////////
    //END EVENT LISTENERS
    //////////////////////////////////////////
});