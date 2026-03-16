const API_URL =
  "https://diet-analysis-func01-d7fdd4awc3dacqew.canadacentral-01.azurewebsites.net/api/nutrition";

const getInsightsBtn = document.getElementById("getInsightsBtn");
const getRecipesBtn = document.getElementById("getRecipesBtn");
const getClustersBtn = document.getElementById("getClustersBtn");

const searchInput = document.getElementById("searchInput");
const dietFilter = document.getElementById("dietFilter");

const executionTime = document.getElementById("executionTime");
const blobName = document.getElementById("blobName");
const statusText = document.getElementById("statusText");
const tableBody = document.getElementById("tableBody");

const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageButtons = document.querySelectorAll(".page-number");

let allData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 2;

let barChartInstance = null;
let scatterChartInstance = null;
let heatmapChartInstance = null;
let pieChartInstance = null;

async function fetchInsights() {
  try {
    statusText.textContent = "Loading...";

    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();

    allData = result.data || [];
    executionTime.textContent = `${result.execution_time_seconds ?? "N/A"} seconds`;
    blobName.textContent = result.blob || "Unknown";
    statusText.textContent = "Loaded successfully";

    populateFilter(allData);
    currentPage = 1;
    applyFilters();
  } catch (error) {
    statusText.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

function populateFilter(data) {
  const uniqueDiets = [...new Set(data.map(item => item.Diet_type))];

  dietFilter.innerHTML = `<option value="all">All Diet Types</option>`;

  uniqueDiets.forEach(diet => {
    const option = document.createElement("option");
    option.value = diet;
    option.textContent = diet;
    dietFilter.appendChild(option);
  });
}

function applyFilters() {
  const selectedDiet = dietFilter.value;
  const searchValue = searchInput.value.trim().toLowerCase();

  filteredData = allData.filter(item => {
    const matchesDiet = selectedDiet === "all" || item.Diet_type === selectedDiet;
    const matchesSearch = item.Diet_type.toLowerCase().includes(searchValue);
    return matchesDiet && matchesSearch;
  });

  currentPage = 1;
  renderAll();
}

function renderAll() {
  renderTable(filteredData);
  renderCharts(filteredData);
  updatePaginationButtons();
}

function renderTable(data) {
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4">No data found.</td>
      </tr>
    `;
    return;
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.Diet_type}</td>
      <td>${Number(item["Protein(g)"]).toFixed(2)}</td>
      <td>${Number(item["Carbs(g)"]).toFixed(2)}</td>
      <td>${Number(item["Fat(g)"]).toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function destroyCharts() {
  if (barChartInstance) barChartInstance.destroy();
  if (scatterChartInstance) scatterChartInstance.destroy();
  if (heatmapChartInstance) heatmapChartInstance.destroy();
  if (pieChartInstance) pieChartInstance.destroy();
}

function renderCharts(data) {
  destroyCharts();

  if (data.length === 0) {
    return;
  }

  const labels = data.map(item => item.Diet_type);
  const proteinData = data.map(item => Number(item["Protein(g)"]));
  const carbsData = data.map(item => Number(item["Carbs(g)"]));
  const fatData = data.map(item => Number(item["Fat(g)"]));

  const barCtx = document.getElementById("barChart");
  const scatterCtx = document.getElementById("scatterChart");
  const heatmapCtx = document.getElementById("heatmapChart");
  const pieCtx = document.getElementById("pieChart");

  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Protein(g)",
          data: proteinData
        },
        {
          label: "Carbs(g)",
          data: carbsData
        },
        {
          label: "Fat(g)",
          data: fatData
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  scatterChartInstance = new Chart(scatterCtx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Protein vs Carbs",
          data: data.map(item => ({
            x: Number(item["Carbs(g)"]),
            y: Number(item["Protein(g)"])
          }))
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Carbs(g)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Protein(g)"
          }
        }
      }
    }
  });

  heatmapChartInstance = new Chart(heatmapCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Protein(g)",
          data: proteinData
        },
        {
          label: "Carbs(g)",
          data: carbsData
        },
        {
          label: "Fat(g)",
          data: fatData
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false
    }
  });

  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Fat(g)",
          data: fatData
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function updatePaginationButtons() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  pageButtons.forEach((btn, index) => {
    const pageNumber = index + 1;

    if (pageNumber <= totalPages) {
      btn.style.display = "inline-block";
      btn.textContent = pageNumber;
      btn.classList.toggle("active", pageNumber === currentPage);
    } else {
      btn.style.display = "none";
    }
  });

  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderTable(filteredData);
    updatePaginationButtons();
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  if (currentPage < totalPages) {
    currentPage++;
    renderTable(filteredData);
    updatePaginationButtons();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable(filteredData);
    updatePaginationButtons();
  }
}

getInsightsBtn.addEventListener("click", fetchInsights);

getRecipesBtn.addEventListener("click", () => {
  statusText.textContent =
    "Recipes feature can reuse the same dataset or be extended later.";
});

getClustersBtn.addEventListener("click", () => {
  statusText.textContent =
    "Clusters feature placeholder added for UI match.";
});

dietFilter.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);

prevPageBtn.addEventListener("click", prevPage);
nextPageBtn.addEventListener("click", nextPage);

pageButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => goToPage(index + 1));
});