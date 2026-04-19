function normalizeAnalyticsDateValue(dateValue) {
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

function getTimeBucket(dateValue, mode) {
    const normalized = normalizeAnalyticsDateValue(dateValue);
    if (!normalized) return "";

    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    if (mode === "day") {
        return normalized;
    }

    if (mode === "week") {
        const temp = new Date(date);
        const dayOfWeek = temp.getDay(); // 0 = Sunday
        const diff = temp.getDate() - dayOfWeek;
        temp.setDate(diff);

        const weekStartYear = temp.getFullYear();
        const weekStartMonth = String(temp.getMonth() + 1).padStart(2, "0");
        const weekStartDay = String(temp.getDate()).padStart(2, "0");

        return `${weekStartYear}-${weekStartMonth}-${weekStartDay}`;
    }

    if (mode === "month") {
        return `${year}-${month}`;
    }

    if (mode === "year") {
        return String(year);
    }

    return normalized;
}

function buildAggregatedChartData(records, dateKey, valueKey, mode) {
    const totals = new Map();

    records.forEach((record) => {
        const bucket = getTimeBucket(record[dateKey], mode);
        if (!bucket) return;

        const value = Number(record[valueKey]) || 0;
        totals.set(bucket, (totals.get(bucket) || 0) + value);
    });

    const labels = Array.from(totals.keys()).sort();
    const data = labels.map((label) => totals.get(label));

    return { labels, data };
}

function formatAnalyticsDateForDisplay(dateValue) {
    const normalizedDate = normalizeAnalyticsDateValue(dateValue);

    if (!normalizedDate) {
        return "Invalid Date";
    }

    return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString("en-US");
}

async function fetchAnalyticsRows(endpoint, token, dataKey) {
    const response = await fetch(endpoint, {
        headers: {
            Authorization: token
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to load ${endpoint}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
        return data;
    }

    return Array.isArray(data[dataKey]) ? data[dataKey] : [];
}

function buildWorkoutChartData(workouts) {
    return {
        labels: workouts.map((workout) => formatAnalyticsDateForDisplay(workout.workout_date)),
        data: workouts.map((workout) => Number(workout.calories_burned) || 0)
    };
}

function buildMealChartData(meals) {
    return {
        labels: meals.map((meal) => formatAnalyticsDateForDisplay(meal.meal_date)),
        data: meals.map((meal) => Number(meal.calories) || 0)
    };
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#1e5a96",
                    font: {
                        weight: "600"
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: "#6b7280"
                },
                grid: {
                    color: "rgba(30, 90, 150, 0.08)"
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: "#6b7280"
                },
                grid: {
                    color: "rgba(30, 90, 150, 0.08)"
                }
            }
        }
    };
}

function renderAnalyticsChart(canvasId, chartState, chartType, chartData, datasetLabel) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        return null;
    }

    if (chartState.chart) {
        chartState.chart.destroy();
    }

    chartState.chart = new Chart(canvas.getContext("2d"), {
        type: chartType,
        data: {
            labels: chartData.labels,
            datasets: [{
                label: datasetLabel,
                data: chartData.data,
                borderWidth: 2,
                borderColor: "#1e5a96",
                backgroundColor: chartType === "line" ? "rgba(46, 123, 180, 0.16)" : "rgba(46, 123, 180, 0.35)",
                pointBackgroundColor: "#27a745",
                pointBorderColor: "#1e5a96",
                tension: 0.25,
                fill: chartType === "line"
            }]
        },
        options: getChartOptions()
    });

    window.setTimeout(() => {
        chartState.chart.resize();
    }, 50);

    return chartState.chart;
}

function setActiveChartButton(target, chartType) {
    document
        .querySelectorAll(`button[data-chart-target="${target}"][data-chart-type]`)
        .forEach((button) => {
            button.classList.toggle("active-chart-button", button.dataset.chartType === chartType);
        });
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = await requireAuthenticatedPage();

    if (!token) {
        return;
    }

    const charts = {
        workouts: { chart: null, type: "bar", aggregate: "day", raw: [], data: { labels: [], data: [] } },
        meals: { chart: null, type: "bar", aggregate: "day", raw: [], data: { labels: [], data: [] } }
    };

    try {
        const [workouts, meals] = await Promise.all([
            fetchAnalyticsRows("/api/workouts", token, "workouts"),
            fetchAnalyticsRows("/api/meals", token, "meals")
        ]);

        charts.workouts.raw = workouts;
        charts.meals.raw = meals;

        charts.workouts.data = buildAggregatedChartData(workouts, "workout_date", "calories_burned", charts.workouts.aggregate);
        charts.meals.data = buildAggregatedChartData(meals, "meal_date", "calories", charts.meals.aggregate);

        if (charts.workouts.data.data.length === 0) {
            document.getElementById("workoutAnalyticsStatus").textContent = "No workout data logged yet.";
        }

        if (charts.meals.data.data.length === 0) {
            document.getElementById("mealAnalyticsStatus").textContent = "No meal data logged yet.";
        }

        renderAnalyticsChart(
            "workoutAnalyticsChart",
            charts.workouts,
            charts.workouts.type,
            charts.workouts.data,
            "Calories Burned"
        );

        renderAnalyticsChart(
            "mealAnalyticsChart",
            charts.meals,
            charts.meals.type,
            charts.meals.data,
            "Calories Consumed"
        );
    } catch (error) {
        console.error("Error loading analytics:", error);
        document.getElementById("workoutAnalyticsStatus").textContent = "Unable to load workout analytics.";
        document.getElementById("mealAnalyticsStatus").textContent = "Unable to load meal analytics.";
    }

    document.querySelectorAll("button[data-chart-target][data-chart-type]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.chartTarget;
            const chartType = button.dataset.chartType;

            if (!charts[target]) return;

            charts[target].type = chartType;
            setActiveChartButton(target, chartType);

            renderAnalyticsChart(
                target === "workouts" ? "workoutAnalyticsChart" : "mealAnalyticsChart",
                charts[target],
                chartType,
                charts[target].data,
                target === "workouts" ? "Calories Burned" : "Calories Consumed"
            );
        });
    });

    document.querySelectorAll(".time-filter").forEach((select) => {
        select.addEventListener("change", () => {
            const target = select.dataset.chartTarget;
            const mode = select.value;

            charts[target].aggregate = mode;

            if (target === "workouts") {
                charts[target].data = buildAggregatedChartData(
                    charts[target].raw,
                    "workout_date",
                    "calories_burned",
                    mode
                );
            } else {
                charts[target].data = buildAggregatedChartData(
                    charts[target].raw,
                    "meal_date",
                    "calories",
                    mode
                );
            }

            renderAnalyticsChart(
                target === "workouts" ? "workoutAnalyticsChart" : "mealAnalyticsChart",
                charts[target],
                charts[target].type,
                charts[target].data,
                target === "workouts" ? "Calories Burned" : "Calories Consumed"
            );
        });
    });
});
