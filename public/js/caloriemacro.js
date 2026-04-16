function normalizeDateValue(dateValue) {
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

function formatDateForDisplay(dateValue) {
    const normalizedDate = normalizeDateValue(dateValue);
    if (!normalizedDate) {
        return "Invalid Date";
    }

    return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString("en-US");
}

function getTodayInputValue() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function scrollToTopForm(formElement) {
    const topOffset = Math.max(formElement.getBoundingClientRect().top + window.scrollY - 20, 0);
    window.scrollTo({ top: topOffset, behavior: "smooth" });
}

function triggerButtonFlash(button) {
    button.classList.remove("attention-flash");
    void button.offsetWidth;
    button.classList.add("attention-flash");

    window.setTimeout(() => {
        button.classList.remove("attention-flash");
    }, 2600);
}

function getDeleteIconSvg() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm-1 12a2 2 0 0 1-2-2V7h16v12a2 2 0 0 1-2 2H6z"></path>
        </svg>
    `;
}

function getFavoriteStarIconSvg() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
        </svg>
    `;
}

function getMealActionColor(action) {
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
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

async function renderMeals() {
    const token = localStorage.getItem("jwtToken");
    const tbody = document.querySelector("#mealTable tbody");

    tbody.innerHTML = "";

    try {
        const response = await fetch("/api/meals", {
            headers: {
                Authorization: token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Failed to fetch meals:", data.message);
            return;
        }

        data.meals.forEach((meal) => {
            const row = document.createElement("tr");
            row.dataset.mealDate = normalizeDateValue(meal.meal_date);
            row.dataset.mealId = meal.meal_id;
            row.innerHTML = `
                <td>${formatDateForDisplay(meal.meal_date)}</td>
                <td>${formatDisplayText(meal.meal_type)}</td>
                <td>${meal.description}</td>
                <td>${meal.calories}</td>
                <td>${meal.protein}</td>
                <td>${meal.fats}</td>
                <td>${meal.carbs}</td>
                <td>
                    <button type="button" class="icon-button favorite-add-button favorite-meal-button" data-meal-id="${meal.meal_id}" aria-label="Add meal to favorites">
                        ${getFavoriteStarIconSvg()}
                    </button>
                </td>
                <td>
                    <button type="button" class="icon-button delete-meal-button" data-meal-id="${meal.meal_id}" aria-label="Delete meal">
                        ${getDeleteIconSvg()}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching meals:", error);
    }
}

async function renderFavoriteMeals() {
    const token = localStorage.getItem("jwtToken");
    const tbody = document.querySelector("#favoriteMealTable tbody");

    tbody.innerHTML = "";

    try {
        const response = await fetch("/api/meals/favorites", {
            headers: {
                Authorization: token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Failed to fetch favorite meals:", data.message);
            return;
        }

        if (data.favorites.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="8" class="empty-table-message">No favorite meals saved yet.</td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }

        data.favorites.forEach((meal) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDisplayText(meal.meal_type)}</td>
                <td>${meal.description}</td>
                <td>${meal.calories}</td>
                <td>${meal.protein}</td>
                <td>${meal.fats}</td>
                <td>${meal.carbs}</td>
                <td><button type="button" class="tablebutton favorite-log-button" data-meal-id="${meal.meal_id}">Use Meal</button></td>
                <td>
                    <button type="button" class="icon-button favorite-remove-button unfavorite-meal-button" data-meal-id="${meal.meal_id}" aria-label="Remove meal from favorites">
                        ${getFavoriteStarIconSvg()}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching favorite meals:", error);
    }
}

function applyFilters() {
    const tbody = document.querySelector("#mealTable tbody");

    const typeFilter = document.getElementById("typeFilter").value.toLowerCase();
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const descriptionFilter = document.getElementById("descriptionFilter").value.toLowerCase();
    const proteinMin = parseInt(document.getElementById("proteinMin").value, 10) || 0;
    const proteinMax = parseInt(document.getElementById("proteinMax").value, 10) || Infinity;
    const caloriesMin = parseInt(document.getElementById("caloriesMin").value, 10) || 0;
    const caloriesMax = parseInt(document.getElementById("caloriesMax").value, 10) || Infinity;
    const fatsMin = parseInt(document.getElementById("fatsMin").value, 10) || 0;
    const fatsMax = parseInt(document.getElementById("fatsMax").value, 10) || Infinity;
    const carbsMin = parseInt(document.getElementById("carbsMin").value, 10) || 0;
    const carbsMax = parseInt(document.getElementById("carbsMax").value, 10) || Infinity;

    Array.from(tbody.rows).forEach((row) => {
        const mealDate = row.dataset.mealDate || "";
        const mealType = row.cells[1].textContent.toLowerCase();
        const mealDescription = row.cells[2].textContent.toLowerCase();
        const calories = parseInt(row.cells[3].textContent, 10) || 0;
        const protein = parseInt(row.cells[4].textContent, 10) || 0;
        const fats = parseInt(row.cells[5].textContent, 10) || 0;
        const carbs = parseInt(row.cells[6].textContent, 10) || 0;

        let showRow = true;

        if (typeFilter && mealType !== typeFilter) showRow = false;
        if (dateFrom && mealDate < dateFrom) showRow = false;
        if (dateTo && mealDate > dateTo) showRow = false;
        if (descriptionFilter && !mealDescription.includes(descriptionFilter)) showRow = false;
        if (protein < proteinMin || protein > proteinMax) showRow = false;
        if (calories < caloriesMin || calories > caloriesMax) showRow = false;
        if (fats < fatsMin || fats > fatsMax) showRow = false;
        if (carbs < carbsMin || carbs > carbsMax) showRow = false;

        row.style.display = showRow ? "" : "none";
    });
}

function clearFilters() {
    document.getElementById("typeFilter").value = "";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("descriptionFilter").value = "";
    document.getElementById("proteinMin").value = "";
    document.getElementById("proteinMax").value = "";
    document.getElementById("caloriesMin").value = "";
    document.getElementById("caloriesMax").value = "";
    document.getElementById("fatsMin").value = "";
    document.getElementById("fatsMax").value = "";
    document.getElementById("carbsMin").value = "";
    document.getElementById("carbsMax").value = "";

    applyFilters();
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = await requireAuthenticatedPage();
    if (!token) {
        return;
    }

    DataModel.setToken(token);

    const addMealButton = document.getElementById("addMealButton");
    const mealDateInput = document.getElementById("mealDate");
    const favoriteMealTable = document.getElementById("favoriteMealTable");
    const mealFormContainer = document.querySelector(".container");
    const mealTable = document.getElementById("mealTable");
    const deleteMealModal = document.getElementById("deleteMealModal");
    const deleteMealModalTitle = document.getElementById("deleteMealModalTitle");
    const deleteMealModalMessage = document.getElementById("deleteMealModalMessage");
    const deleteMealModalStatus = document.getElementById("deleteMealModalStatus");
    const confirmDeleteMealButton = document.getElementById("confirmDeleteMealButton");
    const cancelDeleteMealButton = document.getElementById("cancelDeleteMealButton");
    let pendingMealDeleteId = null;
    let pendingMealAction = "delete";

    mealDateInput.value = getTodayInputValue();

    async function refreshMealTables() {
        await renderMeals();
        await renderFavoriteMeals();
        applyFilters();
    }

    function openDeleteMealModal(mealId, mealLabel, action = "delete") {
        pendingMealDeleteId = mealId;
        pendingMealAction = action;
        const isPositiveAction = action === "favorite";
        deleteMealModalTitle.textContent = action === "unfavorite"
            ? "Remove Favorite Meal"
            : action === "favorite"
                ? "Add Favorite Meal"
                : "Delete Meal";
        deleteMealModalMessage.textContent = action === "unfavorite"
            ? `Are you sure you want to remove this meal from favorites${mealLabel ? `: ${mealLabel}` : ""}?`
            : action === "favorite"
                ? `Add this meal to favorites${mealLabel ? `: ${mealLabel}` : ""}?`
                : `Are you sure you want to delete this meal${mealLabel ? `: ${mealLabel}` : ""}?`;
        confirmDeleteMealButton.textContent = action === "favorite" ? "Add" : action === "unfavorite" ? "Remove" : "Delete";
        confirmDeleteMealButton.classList.toggle("danger-button", !isPositiveAction);
        confirmDeleteMealButton.classList.toggle("success-button", isPositiveAction);
        deleteMealModalStatus.textContent = "";
        deleteMealModalStatus.style.color = "";
        deleteMealModal.classList.remove("hidden");
    }

    function closeDeleteMealModal() {
        pendingMealDeleteId = null;
        pendingMealAction = "delete";
        deleteMealModal.classList.add("hidden");
        deleteMealModalStatus.textContent = "";
        deleteMealModalStatus.style.color = "";
        confirmDeleteMealButton.textContent = "Delete";
        confirmDeleteMealButton.classList.add("danger-button");
        confirmDeleteMealButton.classList.remove("success-button");
    }

    async function deleteMeal(mealId) {
        const response = await fetch(`/api/meals/${mealId}`, {
            method: "DELETE",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to delete meal.");
        }

        return result.message || "Meal deleted!";
    }

    async function removeMealFromFavorites(mealId) {
        const response = await fetch(`/api/meals/${mealId}/favorite`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to remove meal from favorites.");
        }

        return result.message || "Meal removed from favorites!";
    }

    async function addMealToFavorites(mealId) {
        const response = await fetch(`/api/meals/${mealId}/favorite/add`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to add meal to favorites.");
        }

        return result.message || "Meal added to favorites!";
    }

    async function displayCalorieMacroHeader() {
        try {
            const userName = await DataModel.getUserName();
            document.getElementById("calorieMacroHeader").textContent =
                `${userName}'s Calorie and Macro Tracker`;
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

    async function loadSuggestedMeal() {
    const suggestions = await DataModel.getSuggestedMeal();
    const content = document.getElementById('mealSuggestionContent');
    const logButton = document.getElementById('logMealSuggestionButton');
    const result = document.getElementById('mealSuggestionResult');

    if (!suggestions || suggestions.length === 0) {
        content.textContent = 'No suggestions available.';
        logButton.style.display = 'none';
        return;
    }

    // Handle both array and single object responses
    const mealList = Array.isArray(suggestions) ? suggestions : [suggestions];

    content.innerHTML = mealList.map((meal, index) => `
    <div style="flex: 1; display: flex; align-items: flex-start; gap: 6px; padding: 10px; border: 1px solid #c8e6c9; border-radius: 8px; background: #fff;">
        <input type="checkbox" id="mealCheck_${index}" style="margin-top: 3px; flex-shrink: 0; width: 12px; height: 12px;">
        <label for="mealCheck_${index}" style="cursor: pointer; font-size: 12px; line-height: 1.4;">
            <b>${meal.meal_title}</b><br>
            ${meal.description}<br>
            Calories: ${meal.calories} &nbsp;|&nbsp;
            Protein: ${meal.protein}g &nbsp;|&nbsp;
            Carbs: ${meal.carbs}g &nbsp;|&nbsp;
            Fats: ${meal.fats}g
        </label>
    </div>
`).join('');

// Add this block right after the innerHTML assignment
mealList.forEach((_, index) => {
    document.getElementById(`mealCheck_${index}`).addEventListener('change', () => {
        mealList.forEach((_, otherIndex) => {
            if (otherIndex !== index) {
                document.getElementById(`mealCheck_${otherIndex}`).checked = false;
            }
        });
    });
});

    logButton.onclick = async () => {
        const checked = mealList.filter((_, index) => 
            document.getElementById(`mealCheck_${index}`)?.checked
        );

        if (checked.length === 0) {
            result.textContent = 'Please select at least one meal.';
            result.style.color = 'orange';
            return;
        }

        let allSuccess = true;
        for (const meal of checked) {
            const success = await DataModel.logSuggestedMeal(meal);
            if (!success) allSuccess = false;
        }

        if (allSuccess) {
            result.textContent = `${checked.length} meal(s) logged!`;
            result.style.color = 'green';
            await renderMeals();
            applyFilters();
        } else {
            result.textContent = 'Error logging one or more meals.';
            result.style.color = 'red';
        }
    };
}


    async function addMeal() {
        const dateInput = mealDateInput.value;
        const mealTypeInput = document.getElementById("mealType").value;
        const descriptionInput = document.getElementById("mealDescription").value.trim();
        const caloriesInput = parseInt(document.getElementById("calories").value, 10);
        const proteinInput = parseInt(document.getElementById("protein").value, 10);
        const fatsInput = parseInt(document.getElementById("fats").value, 10);
        const carbsInput = parseInt(document.getElementById("carbs").value, 10);
        const favoriteInput = document.getElementById("favoriteMeal").checked;

        if (
            !dateInput ||
            !mealTypeInput ||
            !descriptionInput ||
            Number.isNaN(caloriesInput) ||
            Number.isNaN(proteinInput) ||
            Number.isNaN(fatsInput) ||
            Number.isNaN(carbsInput)
        ) {
            alert("Please fill in all meal fields correctly.");
            return;
        }

        try {
            const response = await fetch("/api/meals", {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    date: dateInput,
                    type: mealTypeInput,
                    description: descriptionInput,
                    calories: caloriesInput,
                    protein: proteinInput,
                    fats: fatsInput,
                    carbs: carbsInput,
                    favorite: favoriteInput
                })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.message || "Failed to add meal.");
                return;
            }

            document.getElementById("mealType").value = "";
            document.getElementById("mealDescription").value = "";
            document.getElementById("calories").value = "";
            document.getElementById("protein").value = "";
            document.getElementById("fats").value = "";
            document.getElementById("carbs").value = "";
            document.getElementById("favoriteMeal").checked = false;
            mealDateInput.value = getTodayInputValue();

            await refreshMealTables();
            console.log("Meal added:", result);
        } catch (error) {
            console.error("Error adding meal:", error);
        }
    }

    favoriteMealTable.addEventListener("click", async (event) => {
        const unfavoriteButton = event.target.closest(".unfavorite-meal-button");
        if (unfavoriteButton) {
            const row = unfavoriteButton.closest("tr");
            const mealDescription = row ? row.cells[1].textContent.trim() : "";
            openDeleteMealModal(unfavoriteButton.dataset.mealId, mealDescription, "unfavorite");
            return;
        }

        const logButton = event.target.closest(".favorite-log-button");
        if (!logButton) {
            return;
        }

        try {
            const response = await fetch("/api/meals/favorites", {
                headers: {
                    Authorization: token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to load favorite meal.");
                return;
            }

            const selectedMeal = data.favorites.find((meal) => String(meal.meal_id) === logButton.dataset.mealId);

            if (!selectedMeal) {
                alert("Favorite meal not found.");
                return;
            }

            mealDateInput.value = getTodayInputValue();
            document.getElementById("mealType").value = selectedMeal.meal_type;
            document.getElementById("mealDescription").value = selectedMeal.description;
            document.getElementById("calories").value = selectedMeal.calories;
            document.getElementById("protein").value = selectedMeal.protein;
            document.getElementById("fats").value = selectedMeal.fats;
            document.getElementById("carbs").value = selectedMeal.carbs;
            document.getElementById("favoriteMeal").checked = false;

            scrollToTopForm(mealFormContainer);
            triggerButtonFlash(addMealButton);
        } catch (error) {
            console.error("Error loading favorite meal:", error);
        }
    });

    mealTable.addEventListener("click", (event) => {
        const favoriteButton = event.target.closest(".favorite-meal-button");
        if (favoriteButton) {
            const row = favoriteButton.closest("tr");
            const mealDescription = row ? row.cells[2].textContent.trim() : "";
            openDeleteMealModal(favoriteButton.dataset.mealId, mealDescription, "favorite");
            return;
        }

        const deleteButton = event.target.closest(".delete-meal-button");
        if (!deleteButton) {
            return;
        }

        const row = deleteButton.closest("tr");
        const mealDescription = row ? row.cells[2].textContent.trim() : "";
        openDeleteMealModal(deleteButton.dataset.mealId, mealDescription);
    });

    confirmDeleteMealButton.addEventListener("click", async () => {
        if (!pendingMealDeleteId) {
            return;
        }

        confirmDeleteMealButton.disabled = true;
        cancelDeleteMealButton.disabled = true;

        try {
            const message = pendingMealAction === "unfavorite"
                ? await removeMealFromFavorites(pendingMealDeleteId)
                : pendingMealAction === "favorite"
                    ? await addMealToFavorites(pendingMealDeleteId)
                    : await deleteMeal(pendingMealDeleteId);
            deleteMealModalStatus.style.color = getMealActionColor(pendingMealAction);
            deleteMealModalStatus.textContent = message;
            await refreshMealTables();
            window.setTimeout(closeDeleteMealModal, 900);
        } catch (error) {
            deleteMealModalStatus.style.color = getMealActionColor(pendingMealAction);
            deleteMealModalStatus.textContent = error.message;
        } finally {
            confirmDeleteMealButton.disabled = false;
            cancelDeleteMealButton.disabled = false;
        }
    });

    cancelDeleteMealButton.addEventListener("click", closeDeleteMealModal);

    deleteMealModal.addEventListener("click", (event) => {
        if (event.target === deleteMealModal) {
            closeDeleteMealModal();
        }
    });

    addMealButton.addEventListener("click", (event) => {
        event.preventDefault();
        addMeal();
    });

    document.getElementById("refreshButton").addEventListener("click", refreshMealTables);
    document.getElementById("clearFiltersButton").addEventListener("click", clearFilters);
    document.getElementById("applyFiltersButton").addEventListener("click", applyFilters);

    displayCalorieMacroHeader();
    displayUserGoal();
    loadSuggestedMeal();
    refreshMealTables();
});



// CHART CARD CODE

// testing visual rep of table
function getMealData() {
  const rows = document.querySelectorAll("#mealTable tbody tr");

  let labels = [];
  let data = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    
    labels.push(cells[0].innerText); // e.g., date
    data.push(parseFloat(cells[7].innerText)); // e.g., meals/reps
  });

  return { labels, data };
}
let chart;

function getMealData() {
  const rows = document.querySelectorAll("#mealTable tbody tr");

  let labels = [];
  let data = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");

    labels.push(cells[0].innerText); // Date
    data.push(parseFloat(cells[3].innerText));
  });

  return { labels, data };
}

function renderChart(type) {
  const canvas = document.getElementById("mealChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const mealData = getMealData();

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: type,
    data: {
      labels: mealData.labels,
      datasets: [{
        label: "Calories Consumed",
        data: mealData.data,
        borderWidth: 2
      }]
    },
    options: {
    responsive: true,
    maintainAspectRatio: false
    }
  });
    setTimeout(() => {
    chart.resize();
  }, 50);
}

window.switchChart = function(type) {
  console.log("switching to:", type);
  renderChart(type);
};

window.addEventListener("load", () => {
  renderChart("bar");
});
