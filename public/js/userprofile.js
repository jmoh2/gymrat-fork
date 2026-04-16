document.addEventListener('DOMContentLoaded', async () => {
    const token = await requireAuthenticatedPage();
    if (!token) {
        return;
    }

    DataModel.setToken(token);

    const userHeading = document.getElementById('userHeading');
    const genderSelect = document.getElementById('gender');
    const ageInput = document.getElementById('age');
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const fitnessGoalSelect = document.getElementById('fitness_goal');
    const exerciseLevelSelect = document.getElementById('exercise_level');
    const result = document.getElementById('result');
    displayUserDetailsMessage(userHeading);

    // Load and display saved values
    const profile = await DataModel.getUserProfile();
    if (profile) {
        genderSelect.value = profile.gender;
        ageInput.value = profile.age;
        heightInput.value = profile.height;
        weightInput.value = profile.weight;
        fitnessGoalSelect.value = profile.fitness_goal;
        exerciseLevelSelect.value = profile.exercise_level;
    }

    // The function that saves everything
    window.save = async function () {
        const gender = genderSelect.value;
        const age = ageInput.value;
        const height = heightInput.value;
        const weight = weightInput.value;
        const fitnessGoal = fitnessGoalSelect.value;
        const exerciseLevel = exerciseLevelSelect.value;

        if (!height || !weight) {
            result.textContent = 'Please enter both height and weight.';
            return;
        }

        const success = await DataModel.updateUserProfile(gender, age, height, weight, fitnessGoal, exerciseLevel);
        result.textContent = success ? 'Saved successfully!' : 'Error saving profile.';
    };
 
    // the thing that removes the loading for the drop down 
    const fitnessSelect = document.getElementById("fitness_goal");
    fitnessSelect.addEventListener("focus", function () {
        const firstOption = fitnessSelect.querySelector('option[value=""]');
        if (firstOption) firstOption.remove();
    });
    const exerciseSelect = document.getElementById("exercise_level");
    exerciseSelect.addEventListener("focus", function () {
        const firstOption = exerciseSelect.querySelector('option[value=""]');
        if (firstOption) firstOption.remove();
    });
    const userGenderSelect = document.getElementById("gender");
    userGenderSelect.addEventListener("focus", function () {
        const firstOption = userGenderSelect.querySelector('option[value=""]');
        if (firstOption) firstOption.remove();
    });
});



// function save() {
//     document.getElementById("result").textContent = "Saved!";
// }


async function displayUserDetailsMessage(userHeading) {
    const userName = await DataModel.getUserName();
    userHeading.textContent = `${userName}'s User Statistics`;
}
