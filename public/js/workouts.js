function normalizeWorkoutDateValue(dateValue) {
    if (!dateValue) {
        return "";
    }

    if (typeof dateValue === "string") {
        return dateValue.includes("T") ? dateValue.split("T")[0] : dateValue;
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toISOString().split("T")[0];
}

function formatWorkoutDateForDisplay(dateValue) {
    const normalizedDate = normalizeWorkoutDateValue(dateValue);
    if (!normalizedDate) {
        return "Invalid Date";
    }

    return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString("en-US");
}

function getTodayWorkoutInputValue() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function scrollToWorkoutForm(formElement) {
    const topOffset = Math.max(formElement.getBoundingClientRect().top + window.scrollY - 20, 0);
    window.scrollTo({ top: topOffset, behavior: "smooth" });
}

function triggerWorkoutButtonFlash(button) {
    button.classList.remove("attention-flash");
    void button.offsetWidth;
    button.classList.add("attention-flash");

    window.setTimeout(() => {
        button.classList.remove("attention-flash");
    }, 2600);
}

function getWorkoutDeleteIconSvg() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm-1 12a2 2 0 0 1-2-2V7h16v12a2 2 0 0 1-2 2H6z"></path>
        </svg>
    `;
}

function getWorkoutFavoriteStarIconSvg() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
        </svg>
    `;
}

function getWorkoutActionColor(action) {
    return action === "favorite" ? "#1f9d55" : "#d64545";
}

function formatDisplayText(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => {
            const upperWord = word.toUpperCase();
            if (upperWord === "HIIT") {
                return "HIIT";
            }

            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

async function renderWorkouts() {
    const token = localStorage.getItem("jwtToken");
    const tbody = document.querySelector("#workoutTable tbody");

    tbody.innerHTML = "";

    try {
        const response = await fetch("/api/workouts", {
            headers: {
                Authorization: token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Failed to fetch workouts:", data.message);
            return;
        }

        data.workouts.forEach((workout) => {
            const row = document.createElement("tr");
            row.dataset.workoutDate = normalizeWorkoutDateValue(workout.workout_date);
            row.dataset.workoutId = workout.workout_id;
            row.innerHTML = `
                <td>${formatWorkoutDateForDisplay(workout.workout_date)}</td>
                <td>${workout.workout_name}</td>
                <td>${formatDisplayText(workout.workout_type)}</td>
                <td>${formatDisplayText(workout.intensity_level)}</td>
                <td>${workout.duration_minutes}</td>
                <td>${workout.calories_burned}</td>
                <td>${workout.notes ?? ""}</td>
                <td>
                    <button type="button" class="icon-button favorite-add-button favorite-workout-button" data-workout-id="${workout.workout_id}" aria-label="Add workout to favorites">
                        ${getWorkoutFavoriteStarIconSvg()}
                    </button>
                </td>
                <td>
                    <button type="button" class="icon-button delete-workout-button" data-workout-id="${workout.workout_id}" aria-label="Delete workout">
                        ${getWorkoutDeleteIconSvg()}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching workouts:", error);
    }
}

async function renderFavoriteWorkouts() {
    const token = localStorage.getItem("jwtToken");
    const tbody = document.querySelector("#favoriteWorkoutTable tbody");

    tbody.innerHTML = "";

    try {
        const response = await fetch("/api/workouts/favorites", {
            headers: {
                Authorization: token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Failed to fetch favorite workouts:", data.message);
            return;
        }

        if (data.favorites.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="8" class="empty-table-message">No favorite workouts saved yet.</td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }

        data.favorites.forEach((workout) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${workout.workout_name}</td>
                <td>${formatDisplayText(workout.workout_type)}</td>
                <td>${formatDisplayText(workout.intensity_level)}</td>
                <td>${workout.duration_minutes}</td>
                <td>${workout.calories_burned}</td>
                <td>${workout.notes ?? ""}</td>
                <td><button type="button" class="tablebutton favorite-log-button" data-workout-id="${workout.workout_id}">Use Workout</button></td>
                <td>
                    <button type="button" class="icon-button favorite-remove-button unfavorite-workout-button" data-workout-id="${workout.workout_id}" aria-label="Remove workout from favorites">
                        ${getWorkoutFavoriteStarIconSvg()}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching favorite workouts:", error);
    }
}

function applyFilters() {
    const tbody = document.querySelector("#workoutTable tbody");

    const typeFilter = document.getElementById("typeFilter").value.toLowerCase();
    const intensityFilter = document.getElementById("intensityFilter").value.toLowerCase();
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const nameFilter = document.getElementById("nameFilter").value.toLowerCase();
    const durationMin = parseInt(document.getElementById("durationMin").value, 10) || 0;
    const durationMax = parseInt(document.getElementById("durationMax").value, 10) || Infinity;
    const caloriesMin = parseInt(document.getElementById("caloriesMin").value, 10) || 0;
    const caloriesMax = parseInt(document.getElementById("caloriesMax").value, 10) || Infinity;

    Array.from(tbody.rows).forEach((row) => {
        const workoutDate = row.dataset.workoutDate || "";
        const workoutName = row.cells[1].textContent.toLowerCase();
        const workoutType = row.cells[2].textContent.toLowerCase();
        const intensityLevel = row.cells[3].textContent.toLowerCase();
        const duration = parseInt(row.cells[4].textContent, 10) || 0;
        const calories = parseInt(row.cells[5].textContent, 10) || 0;

        let showRow = true;

        if (typeFilter && workoutType !== typeFilter) showRow = false;
        if (intensityFilter && intensityLevel !== intensityFilter) showRow = false;
        if (dateFrom && workoutDate < dateFrom) showRow = false;
        if (dateTo && workoutDate > dateTo) showRow = false;
        if (nameFilter && !workoutName.includes(nameFilter)) showRow = false;
        if (duration < durationMin || duration > durationMax) showRow = false;
        if (calories < caloriesMin || calories > caloriesMax) showRow = false;

        row.style.display = showRow ? "" : "none";
    });
}

function clearFilters() {
    document.getElementById("nameFilter").value = "";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("durationMin").value = "";
    document.getElementById("durationMax").value = "";
    document.getElementById("caloriesMin").value = "";
    document.getElementById("caloriesMax").value = "";
    document.getElementById("typeFilter").value = "";
    document.getElementById("intensityFilter").value = "";

    applyFilters();
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = await requireAuthenticatedPage();
    if (!token) {
        return;
    }

    DataModel.setToken(token);

    const submitButton = document.getElementById("submit");
    const workoutDateInput = document.getElementById("date");
    const favoriteWorkoutTable = document.getElementById("favoriteWorkoutTable");
    const workoutFormContainer = document.querySelector(".container");
    const workoutTable = document.getElementById("workoutTable");
    const deleteWorkoutModal = document.getElementById("deleteWorkoutModal");
    const deleteWorkoutModalTitle = document.getElementById("deleteWorkoutModalTitle");
    const deleteWorkoutModalMessage = document.getElementById("deleteWorkoutModalMessage");
    const deleteWorkoutModalStatus = document.getElementById("deleteWorkoutModalStatus");
    const confirmDeleteWorkoutButton = document.getElementById("confirmDeleteWorkoutButton");
    const cancelDeleteWorkoutButton = document.getElementById("cancelDeleteWorkoutButton");
    let pendingWorkoutDeleteId = null;
    let pendingWorkoutAction = "delete";

    workoutDateInput.value = getTodayWorkoutInputValue();

    async function refreshWorkoutTables() {
        await renderWorkouts();
        await renderFavoriteWorkouts();
        applyFilters();
    }

    function openDeleteWorkoutModal(workoutId, workoutLabel, action = "delete") {
        pendingWorkoutDeleteId = workoutId;
        pendingWorkoutAction = action;
        const isPositiveAction = action === "favorite";
        deleteWorkoutModalTitle.textContent = action === "unfavorite"
            ? "Remove Favorite Workout"
            : action === "favorite"
                ? "Add Favorite Workout"
                : "Delete Workout";
        deleteWorkoutModalMessage.textContent = action === "unfavorite"
            ? `Are you sure you want to remove this workout from favorites${workoutLabel ? `: ${workoutLabel}` : ""}?`
            : action === "favorite"
                ? `Add this workout to favorites${workoutLabel ? `: ${workoutLabel}` : ""}?`
                : `Are you sure you want to delete this workout${workoutLabel ? `: ${workoutLabel}` : ""}?`;
        confirmDeleteWorkoutButton.textContent = action === "favorite" ? "Add" : action === "unfavorite" ? "Remove" : "Delete";
        confirmDeleteWorkoutButton.classList.toggle("danger-button", !isPositiveAction);
        confirmDeleteWorkoutButton.classList.toggle("success-button", isPositiveAction);
        deleteWorkoutModalStatus.textContent = "";
        deleteWorkoutModalStatus.style.color = "";
        deleteWorkoutModal.classList.remove("hidden");
    }

    function closeDeleteWorkoutModal() {
        pendingWorkoutDeleteId = null;
        pendingWorkoutAction = "delete";
        deleteWorkoutModal.classList.add("hidden");
        deleteWorkoutModalStatus.textContent = "";
        deleteWorkoutModalStatus.style.color = "";
        confirmDeleteWorkoutButton.textContent = "Delete";
        confirmDeleteWorkoutButton.classList.add("danger-button");
        confirmDeleteWorkoutButton.classList.remove("success-button");
    }

    async function deleteWorkout(workoutId) {
        const response = await fetch(`/api/workouts/${workoutId}`, {
            method: "DELETE",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to delete workout.");
        }

        return result.message || "Workout deleted!";
    }

    async function removeWorkoutFromFavorites(workoutId) {
        const response = await fetch(`/api/workouts/${workoutId}/favorite`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to remove workout from favorites.");
        }

        return result.message || "Workout removed from favorites!";
    }

    async function addWorkoutToFavorites(workoutId) {
        const response = await fetch(`/api/workouts/${workoutId}/favorite/add`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to add workout to favorites.");
        }

        return result.message || "Workout added to favorites!";
    }

    async function displayWorkoutHeader() {
        try {
            const userName = await DataModel.getUserName();
            document.getElementById("workoutHeader").textContent =
                `${userName}'s Workout Input and History`;
        } catch (error) {
            console.error("Error fetching username:", error);
        }
    }

    async function displayUserGoal() {
        try {
            const profile = await DataModel.getUserProfile();
            let goalText = profile?.fitness_goal;

            if (!goalText) {
                return;
            }

            document.getElementById("currentGoal").textContent = formatDisplayText(goalText);
            document.getElementById("goalCard").style.display = "inline-flex";
        } catch (error) {
            console.error("Error fetching goal:", error);
        }
    }

    async function loadSuggestedWorkout() {
    const suggestions = await DataModel.getSuggestedWorkout();
    const content = document.getElementById("suggestionContent");
    const logButton = document.getElementById("logSuggestionButton");
    const suggestionResult = document.getElementById("suggestionResult");

    if (!suggestions || suggestions.length === 0) {
        content.textContent = "No suggestion available.";
        logButton.style.display = "none";
        return;
    }

    const workoutList = Array.isArray(suggestions) ? suggestions : [suggestions];

    content.innerHTML = workoutList.map((workout, index) => `
    <div style="flex: 1; display: flex; align-items: flex-start; gap: 6px; padding: 10px; border: 1px solid #c8e6c9; border-radius: 8px; background: #fff;">
        <input type="checkbox" id="workoutCheck_${index}" style="margin-top: 3px; flex-shrink: 0; width: 12px; height: 12px;">
        <label for="workoutCheck_${index}" style="cursor: pointer; font-size: 12px; line-height: 1.4;">
            <b>${workout.workout_name}</b><br>
            Type: ${formatDisplayText(workout.workout_type)}<br>
            Intensity: ${formatDisplayText(workout.intensity_level)}<br>
            Duration: ${workout.duration_minutes} mins<br>
            Calories: ${workout.calories_burned}
        </label>
    </div>
`).join('');

    // Only allow one checkbox at a time
    workoutList.forEach((_, index) => {
        document.getElementById(`workoutCheck_${index}`).addEventListener('change', () => {
            workoutList.forEach((_, otherIndex) => {
                if (otherIndex !== index) {
                    document.getElementById(`workoutCheck_${otherIndex}`).checked = false;
                }
            });
        });
    });

    logButton.onclick = async () => {
        const checked = workoutList.filter((_, index) =>
            document.getElementById(`workoutCheck_${index}`)?.checked
        );

        if (checked.length === 0) {
            suggestionResult.textContent = "Please select a workout.";
            suggestionResult.style.color = "orange";
            return;
        }

        const success = await DataModel.logSuggestedWorkout(checked[0]);
        if (success) {
            suggestionResult.textContent = "Logged!";
            suggestionResult.style.color = "green";
            await refreshWorkoutTables();
        } else {
            suggestionResult.textContent = "Error logging workout.";
            suggestionResult.style.color = "red";
        }
    };
}

    async function submitWorkout() {
        const workoutName = document.getElementById("workoutName").value.trim();
        const workoutType = document.getElementById("workoutType").value;
        const workoutIntensity = document.getElementById("workoutIntensity").value;
        const duration = document.getElementById("duration").value;
        const notes = document.getElementById("notes").value.trim();
        const date = workoutDateInput.value;
        const caloriesBurned = document.getElementById("caloriesBurned").value;
        const favorite = document.getElementById("favoriteWorkout").checked;

        if (!workoutName || !workoutType || !workoutIntensity || !duration || !date || !caloriesBurned) {
            alert("Please fill in all required workout fields.");
            return;
        }

        try {
            const response = await fetch("/api/workouts", {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workoutName,
                    workoutType,
                    workoutIntensity,
                    caloriesBurned,
                    duration,
                    notes,
                    date,
                    favorite
                })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.message || "Failed to submit workout.");
                return;
            }

            document.getElementById("workoutName").value = "";
            document.getElementById("workoutType").value = "cardio";
            document.getElementById("workoutIntensity").value = "low";
            document.getElementById("caloriesBurned").value = "";
            document.getElementById("duration").value = "";
            document.getElementById("notes").value = "";
            document.getElementById("favoriteWorkout").checked = false;
            workoutDateInput.value = getTodayWorkoutInputValue();

            await refreshWorkoutTables();
            console.log("Workout saved:", result);
        } catch (error) {
            console.error("Error submitting workout:", error);
        }
    }

    favoriteWorkoutTable.addEventListener("click", async (event) => {
        const unfavoriteButton = event.target.closest(".unfavorite-workout-button");
        if (unfavoriteButton) {
            const row = unfavoriteButton.closest("tr");
            const workoutName = row ? row.cells[0].textContent.trim() : "";
            openDeleteWorkoutModal(unfavoriteButton.dataset.workoutId, workoutName, "unfavorite");
            return;
        }

        const logButton = event.target.closest(".favorite-log-button");
        if (!logButton) {
            return;
        }

        try {
            const response = await fetch("/api/workouts/favorites", {
                headers: {
                    Authorization: token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to load favorite workout.");
                return;
            }

            const selectedWorkout = data.favorites.find(
                (workout) => String(workout.workout_id) === logButton.dataset.workoutId
            );

            if (!selectedWorkout) {
                alert("Favorite workout not found.");
                return;
            }

            workoutDateInput.value = getTodayWorkoutInputValue();
            document.getElementById("workoutName").value = selectedWorkout.workout_name;
            document.getElementById("workoutType").value = selectedWorkout.workout_type;
            document.getElementById("workoutIntensity").value = selectedWorkout.intensity_level;
            document.getElementById("caloriesBurned").value = selectedWorkout.calories_burned ?? "";
            document.getElementById("duration").value = selectedWorkout.duration_minutes;
            document.getElementById("notes").value = selectedWorkout.notes ?? "";
            document.getElementById("favoriteWorkout").checked = false;

            scrollToWorkoutForm(workoutFormContainer);
            triggerWorkoutButtonFlash(submitButton);
        } catch (error) {
            console.error("Error loading favorite workout:", error);
        }
    });

    workoutTable.addEventListener("click", (event) => {
        const favoriteButton = event.target.closest(".favorite-workout-button");
        if (favoriteButton) {
            const row = favoriteButton.closest("tr");
            const workoutName = row ? row.cells[1].textContent.trim() : "";
            openDeleteWorkoutModal(favoriteButton.dataset.workoutId, workoutName, "favorite");
            return;
        }

        const deleteButton = event.target.closest(".delete-workout-button");
        if (!deleteButton) {
            return;
        }

        const row = deleteButton.closest("tr");
        const workoutName = row ? row.cells[1].textContent.trim() : "";
        openDeleteWorkoutModal(deleteButton.dataset.workoutId, workoutName);
    });

    confirmDeleteWorkoutButton.addEventListener("click", async () => {
        if (!pendingWorkoutDeleteId) {
            return;
        }

        confirmDeleteWorkoutButton.disabled = true;
        cancelDeleteWorkoutButton.disabled = true;

        try {
            const message = pendingWorkoutAction === "unfavorite"
                ? await removeWorkoutFromFavorites(pendingWorkoutDeleteId)
                : pendingWorkoutAction === "favorite"
                    ? await addWorkoutToFavorites(pendingWorkoutDeleteId)
                    : await deleteWorkout(pendingWorkoutDeleteId);
            deleteWorkoutModalStatus.style.color = getWorkoutActionColor(pendingWorkoutAction);
            deleteWorkoutModalStatus.textContent = message;
            await refreshWorkoutTables();
            window.setTimeout(closeDeleteWorkoutModal, 900);
        } catch (error) {
            deleteWorkoutModalStatus.style.color = getWorkoutActionColor(pendingWorkoutAction);
            deleteWorkoutModalStatus.textContent = error.message;
        } finally {
            confirmDeleteWorkoutButton.disabled = false;
            cancelDeleteWorkoutButton.disabled = false;
        }
    });

    cancelDeleteWorkoutButton.addEventListener("click", closeDeleteWorkoutModal);

    deleteWorkoutModal.addEventListener("click", (event) => {
        if (event.target === deleteWorkoutModal) {
            closeDeleteWorkoutModal();
        }
    });

    submitButton.addEventListener("click", (event) => {
        event.preventDefault();
        submitWorkout();
    });

    document.getElementById("refreshButton").addEventListener("click", refreshWorkoutTables);
    document.getElementById("clearFiltersButton").addEventListener("click", clearFilters);
    document.getElementById("applyFiltersButton").addEventListener("click", applyFilters);

    displayWorkoutHeader();
    displayUserGoal();
    loadSuggestedWorkout();
    refreshWorkoutTables();
});


