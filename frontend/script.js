const RECIPES_API = "http://localhost:7071/api/recipes";
const NUTRITION_API = "http://localhost:7071/api/nutrition";
const REGISTER_API = "http://localhost:7071/api/register";
const LOGIN_API = "http://localhost:7071/api/login";

let currentPage = 1;
const pageSize = 2;
let currentDiet = "all";
let currentSearch = "";
let totalPages = 1;

let barChart = null;
let scatterChart = null;
let heatmapChart = null;
let pieChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("nameInput");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");

  const registerBtn = document.getElementById("registerBtn");
  const loginBtn = document.getElementById("loginBtn");
  const googleLoginBtnModal = document.getElementById("googleLoginBtnModal");
  const githubLoginBtnModal = document.getElementById("githubLoginBtnModal");
  const logoutBtn = document.getElementById("logoutBtn");

  const authMessage = document.getElementById("authMessage");
  const loggedInUser = document.getElementById("loggedInUser");

  const searchInput = document.getElementById("searchInput");
  const dietFilter = document.getElementById("dietFilter");
  const getInsightsBtn = document.getElementById("getInsightsBtn");
  const getRecipesBtn = document.getElementById("getRecipesBtn");
  const getClustersBtn = document.getElementById("getClustersBtn");

  const executionTime = document.getElementById("executionTime");
  const blobName = document.getElementById("blobName");
  const statusText = document.getElementById("statusText");
  const tableBody = document.getElementById("tableBody");

  const pageBtns = document.querySelectorAll(".page-number");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  function showLoggedOutState() {
    document.body.classList.remove("logged-in");
    document.body.classList.add("logged-out");
    loggedInUser.textContent = "Guest User";
  }

  function showLoggedInState(name) {
    document.body.classList.remove("logged-out");
    document.body.classList.add("logged-in");
    loggedInUser.textContent = name || "User";
  }

  function clearAuthForm() {
    if (nameInput) nameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (authMessage) authMessage.textContent = "";
  }

  function populateDietOptions() {
    const diets = ["all", "dash", "keto", "mediterranean", "paleo", "vegan"];
    dietFilter.innerHTML = "";

    diets.forEach((diet) => {
      const option = document.createElement("option");
      option.value = diet;
      option.textContent = diet === "all" ? "All Diet Types" : diet;
      dietFilter.appendChild(option);
    });
  }

  async function loadRecipes() {
    try {
      statusText.textContent = "Loading...";

      const url = new URL(RECIPES_API);
      url.searchParams.set("page", currentPage);
      url.searchParams.set("page_size", pageSize);

      if (currentDiet !== "all") {
        url.searchParams.set("diet", currentDiet);
      }

      if (currentSearch) {
        url.searchParams.set("search", currentSearch);
      }

      const response = await fetch(url);
      const result = await response.json();

      totalPages = result.total_pages || 1;

      renderTable(result.data || []);
      updatePagination(result.page || 1, totalPages);

      statusText.textContent = "Loaded successfully";
      executionTime.textContent = "From recipes API";
      blobName.textContent = "processed/cleaned_diets.csv";
    } catch (error) {
      console.error("Recipes load error:", error);
      statusText.textContent = "Error loading data";
    }
  }

  async function loadCharts() {
    try {
      const response = await fetch(NUTRITION_API);
      const result = await response.json();
      renderCharts(result.data || []);
    } catch (error) {
      console.error("Chart load error:", error);
    }
  }

  function renderTable(data) {
    tableBody.innerHTML = "";

    if (!data.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4">No results found</td>
        </tr>
      `;
      return;
    }

    data.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.Diet_type || ""}</td>
        <td>${item["Protein(g)"] ?? ""}</td>
        <td>${item["Carbs(g)"] ?? ""}</td>
        <td>${item["Fat(g)"] ?? ""}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  function updatePagination(page, total) {
    pageBtns.forEach((btn, index) => {
      const pageNumber = index + 1;
      btn.classList.toggle("active", pageNumber === page);
    });

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= total;
  }

  function destroyCharts() {
    if (barChart) barChart.destroy();
    if (scatterChart) scatterChart.destroy();
    if (heatmapChart) heatmapChart.destroy();
    if (pieChart) pieChart.destroy();
  }

  function renderCharts(data) {
    destroyCharts();

    const labels = data.map((item) => item.Diet_type);
    const protein = data.map((item) => item["Protein(g)"]);
    const carbs = data.map((item) => item["Carbs(g)"]);
    const fat = data.map((item) => item["Fat(g)"]);

    const barCanvas = document.getElementById("barChart");
    const scatterCanvas = document.getElementById("scatterChart");
    const heatmapCanvas = document.getElementById("heatmapChart");
    const pieCanvas = document.getElementById("pieChart");

    if (barCanvas) {
      barChart = new Chart(barCanvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Protein(g)", data: protein },
            { label: "Carbs(g)", data: carbs },
            { label: "Fat(g)", data: fat }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    if (scatterCanvas) {
      scatterChart = new Chart(scatterCanvas, {
        type: "scatter",
        data: {
          datasets: [{
            label: "Protein vs Carbs",
            data: data.map((item) => ({
              x: item["Carbs(g)"],
              y: item["Protein(g)"]
            }))
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    if (heatmapCanvas) {
      heatmapChart = new Chart(heatmapCanvas, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Fat(g)",
            data: fat
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    if (pieCanvas) {
      pieChart = new Chart(pieCanvas, {
        type: "pie",
        data: {
          labels,
          datasets: [{
            data: data.map(() => 1)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }

  registerBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!name || !email || !password) {
      authMessage.textContent = "Please fill all fields.";
      return;
    }

    try {
      const response = await fetch(REGISTER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        authMessage.textContent = result.error || "Register failed.";
        return;
      }

      authMessage.textContent = result.message || "Registered successfully.";
      showLoggedInState(name);
    } catch (error) {
      console.error("Register error:", error);
      authMessage.textContent = "Register request failed.";
    }
  });

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      authMessage.textContent = "Please enter email and password.";
      return;
    }

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        authMessage.textContent = result.error || "Login failed.";
        return;
      }

      authMessage.textContent = result.message || "Login success.";
      showLoggedInState(result.name || email);
    } catch (error) {
      console.error("Login error:", error);
      authMessage.textContent = "Login request failed.";
    }
  });

  googleLoginBtnModal.addEventListener("click", () => {
    authMessage.textContent = "Google login demo successful.";
    showLoggedInState("Google User");
  });

  githubLoginBtnModal.addEventListener("click", () => {
    authMessage.textContent = "GitHub login demo successful.";
    showLoggedInState("GitHub User");
  });

  logoutBtn.addEventListener("click", () => {
    clearAuthForm();
    showLoggedOutState();
  });

  dietFilter.addEventListener("change", () => {
    currentDiet = dietFilter.value;
    currentPage = 1;
    loadRecipes();
  });

  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value.trim();
    currentPage = 1;
    loadRecipes();
  });

  getInsightsBtn.addEventListener("click", () => {
    loadRecipes();
    loadCharts();
  });

  getRecipesBtn.addEventListener("click", () => {
    loadRecipes();
  });

  getClustersBtn.addEventListener("click", () => {
    statusText.textContent = "Clusters not implemented";
  });

  pageBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      currentPage = index + 1;
      loadRecipes();
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadRecipes();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadRecipes();
    }
  });

  populateDietOptions();
  showLoggedOutState();
  loadRecipes();
  loadCharts();
});