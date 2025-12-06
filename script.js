document.addEventListener("DOMContentLoaded", () => {
// Theme Toggle
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
document.body.classList.toggle("dark-mode");
const icon = themeToggle.querySelector("i");
icon.className = document.body.classList.contains("dark-mode")
? "fas fa-sun"
: "fas fa-moon";
localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
});

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
document.body.classList.add("dark-mode");
themeToggle.querySelector("i").className = "fas fa-sun";
}

// Initialize charts
initializeCharts();
drawSheetPileDiagram();
setupEventListeners();

// Modal functionality
setupModal();
});

let safetyGaugeChart = null;
let gradientChart = null;
let sensitivityChart = null;
let currentChartType = 'bar';

// Hydraulic calculations
function calculateSafetyFactor() {
// Get input values
const gamma_sat = parseFloat(document.getElementById("gamma_sat").value);
const gamma_w = parseFloat(document.getElementById("gamma_w").value);
const delta_h = parseFloat(document.getElementById("delta_h").value);
const flow_path = parseFloat(document.getElementById("flow_path").value);
const area = parseFloat(document.getElementById("area").value);
const conductivity = parseFloat(document.getElementById("conductivity").value);

// Validate inputs
if (isNaN(gamma_sat) || isNaN(gamma_w) || isNaN(delta_h) || isNaN(flow_path)) {
alert("Please fill in all required fields (γ_sat, γ_w, Δh, L)");
return;
}

// Calculate gradients
const i_actual = delta_h / flow_path;
const i_critical = (gamma_sat - gamma_w) / gamma_w;
const fs = i_critical / i_actual;

// Calculate optional flow rate
let flow_rate = "N/A";
if (!isNaN(area) && !isNaN(conductivity) && area > 0 && conductivity > 0) {
flow_rate = (conductivity * area * i_actual).toFixed(6) + " m³/s";
}

// Update results display
document.getElementById("iActual").textContent = i_actual.toFixed(4);
document.getElementById("iCritical").textContent = i_critical.toFixed(4);
document.getElementById("fsValue").textContent = fs.toFixed(3);

// Update safety status
const statusElement = document.getElementById("safetyStatus");
if (fs >= 1.5) {
statusElement.textContent = "SAFE";
statusElement.className = "status-badge status-safe";
} else if (fs >= 1.0) {
statusElement.textContent = "MARGINAL";
statusElement.className = "status-badge status-pending";
} else {
statusElement.textContent = "UNSAFE";
statusElement.className = "status-badge status-unsafe";
}

// Update flow rate if calculated
if (flow_rate !== "N/A") {
document.getElementById("flowRate").textContent = flow_rate;
}

// Update recommendations
updateRecommendations(fs, i_actual, i_critical);

// Update charts
updateSafetyGauge(fs);
updateGradientChart(i_actual, i_critical, fs);
updateSensitivityAnalysis(gamma_sat, gamma_w, flow_path);
}

function updateRecommendations(fs, i_actual, i_critical) {
const recommendations = document.getElementById("recommendations");
let html = '<h4><i class="fas fa-lightbulb"></i> Recommendations</h4>';

if (fs >= 1.5) {
html += `
<div class="recommendation-item">
<i class="fas fa-check-circle text-success"></i>
<strong>Structure is safe against boiling.</strong>
<ul>
<li>No immediate action required</li>
<li>Consider monitoring during extreme events</li>
<li>Periodic inspections recommended</li>
</ul>
</div>
`;
} else if (fs >= 1.0) {
html += `
<div class="recommendation-item">
<i class="fas fa-exclamation-triangle text-warning"></i>
<strong>Structure is at marginal safety level.</strong>
<ul>
<li>Consider increasing flow path length</li>
<li>Monitor hydraulic heads regularly</li>
<li>Implement drainage measures if possible</li>
<li>Consider using denser backfill material</li>
</ul>
</div>
`;
} else {
html += `
<div class="recommendation-item">
<i class="fas fa-exclamation-circle text-danger"></i>
<strong>Structure is unsafe - Immediate action required!</strong>
<ul>
<li><strong>Increase flow path length significantly</strong></li>
<li>Install drainage system to reduce hydraulic head</li>
<li>Consider sheet pile extension</li>
<li>Use filter material to prevent soil loss</li>
<li>Consult a geotechnical engineer immediately</li>
</ul>
</div>
`;
}

// Add engineering notes
html += `
<div class="engineering-notes">
<h5>Engineering Notes:</h5>
<p>Actual Gradient (i_actual): ${i_actual.toFixed(4)}</p>
<p>Critical Gradient (i_critical): ${i_critical.toFixed(4)}</p>
<p>Safety Margin: ${(fs - 1).toFixed(3)}</p>
</div>
`;

recommendations.innerHTML = html;
}

// Chart Functions
function initializeCharts() {
// Safety Gauge Chart
const gaugeCtx = document.getElementById('safetyGauge').getContext('2d');
safetyGaugeChart = new Chart(gaugeCtx, {
type: 'doughnut',
data: {
datasets: [{
data: [0, 100],
backgroundColor: ['#e74c3c', '#ecf0f1'],
borderWidth: 0,
circumference: 180,
rotation: 270
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
cutout: '80%',
plugins: {
legend: { display: false },
tooltip: { enabled: false }
}
}
});

// Gradient Chart
const gradientCtx = document.getElementById('gradientChart').getContext('2d');
gradientChart = new Chart(gradientCtx, {
type: currentChartType,
data: {
labels: ['Actual Gradient', 'Critical Gradient'],
datasets: [{
label: 'Hydraulic Gradient',
data: [0, 0],
backgroundColor: ['#3498db', '#e74c3c'],
borderColor: ['#2980b9', '#c0392b'],
borderWidth: 2
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
scales: {
y: {
beginAtZero: true,
title: {
display: true,
text: 'Gradient Value'
}
}
},
plugins: {
legend: {
display: true,
position: 'top'
}
}
}
});

// Sensitivity Chart
const sensitivityCtx = document.getElementById('sensitivityChart').getContext('2d');
sensitivityChart = new Chart(sensitivityCtx, {
type: 'line',
data: {
labels: [],
datasets: [{
label: 'Safety Factor (FS)',
data: [],
borderColor: '#3498db',
backgroundColor: 'rgba(52, 152, 219, 0.1)',
fill: true,
tension: 0.4
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
scales: {
x: {
title: {
display: true,
text: 'Hydraulic Head Difference (Δh)'
}
},
y: {
beginAtZero: true,
title: {
display: true,
text: 'Safety Factor'
},
ticks: {
callback: function(value) {
return value.toFixed(2);
}
}
}
},
plugins: {
annotation: {
annotations: {
line1: {
type: 'line',
yMin: 1,
yMax: 1,
borderColor: '#e74c3c',
borderWidth: 2,
borderDash: [5, 5],
label: {
display: true,
content: 'Safety Threshold (FS=1)',
position: 'end'
}
}
}
}
}
}
});
}

function updateSafetyGauge(fs) {
const normalizedValue = Math.min(Math.max(fs, 0), 2) / 2 * 100;

safetyGaugeChart.data.datasets[0].data = [normalizedValue, 100 - normalizedValue];
safetyGaugeChart.data.datasets[0].backgroundColor = [
fs >= 1 ? '#27ae60' : fs >= 0.5 ? '#f39c12' : '#e74c3c',
'#ecf0f1'
];
safetyGaugeChart.update();
}

function updateGradientChart(i_actual, i_critical, fs) {
if (currentChartType === 'bar') {
gradientChart.data.datasets[0].data = [i_actual, i_critical];
} else {
// For radar chart (if implemented)
gradientChart.data.datasets[0].data = [i_actual, i_critical, fs];
}
gradientChart.update();
}

function toggleChartType() {
currentChartType = currentChartType === 'bar' ? 'radar' : 'bar';
gradientChart.config.type = currentChartType;
gradientChart.update();
}

function updateSensitivityAnalysis(gamma_sat, gamma_w, flow_path) {
const delta_h_values = [];
const fs_values = [];
const current_dh = parseFloat(document.getElementById("delta_h").value);

// Generate data points
for (let dh = 1; dh <= 20; dh += 0.5) {
const i_actual = dh / flow_path;
const i_critical = (gamma_sat - gamma_w) / gamma_w;
const fs = i_critical / i_actual;

delta_h_values.push(dh.toFixed(1));
fs_values.push(fs);
}

sensitivityChart.data.labels = delta_h_values;
sensitivityChart.data.datasets[0].data = fs_values;

// Update threshold line
const thresholdIndex = delta_h_values.indexOf(current_dh.toFixed(1));
if (sensitivityChart.options.plugins.annotation.annotations.point1) {
sensitivityChart.options.plugins.annotation.annotations.point1.xMin = thresholdIndex;
sensitivityChart.options.plugins.annotation.annotations.point1.xMax = thresholdIndex;
} else {
sensitivityChart.options.plugins.annotation.annotations.point1 = {
type: 'line',
xMin: thresholdIndex,
xMax: thresholdIndex,
borderColor: '#2c3e50',
borderWidth: 3,
label: {
display: true,
content: 'Current Value',
position: 'top'
}
};
}

sensitivityChart.update();
}

// Sheet Pile Diagram
function drawSheetPileDiagram() {
const svg = document.getElementById('sheetPileDiagram');
svg.innerHTML = '';

const width = svg.clientWidth || 400;
const height = 200;

// Set SVG dimensions
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

// Create diagram elements
const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

// Soil layer
const soil = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
soil.setAttribute('x', '0');
soil.setAttribute('y', '50');
soil.setAttribute('width', width.toString());
soil.setAttribute('height', '150');
soil.setAttribute('fill', '#6c757d');
soil.setAttribute('opacity', '0.8');
g.appendChild(soil);

// Sheet pile
const sheetPile = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
sheetPile.setAttribute('x', (width/2 - 5).toString());
sheetPile.setAttribute('y', '0');
sheetPile.setAttribute('width', '10');
sheetPile.setAttribute('height', '200');
sheetPile.setAttribute('fill', '#dc3545');
g.appendChild(sheetPile);

// Water flow arrows
const delta_h = parseFloat(document.getElementById("delta_h").value) || 8.5;
const flowScale = Math.min(delta_h / 20, 1);

for (let i = 0; i < 5; i++) {
const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
const x = width/2 + 20 + i * 40;
const y = 100 + i * 15;

arrow.setAttribute('d', `M${x-20},${y} L${x},${y} L${x-5},${y-5} M${x},${y} L${x-5},${y+5}`);
arrow.setAttribute('stroke', '#007bff');
arrow.setAttribute('stroke-width', '2');
arrow.setAttribute('fill', 'none');
arrow.setAttribute('opacity', '0.7');
g.appendChild(arrow);
}

// Head difference markers
const h1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
h1.setAttribute('x1', '50');
h1.setAttribute('y1', '30');
h1.setAttribute('x2', '50');
h1.setAttribute('y2', '80');
h1.setAttribute('stroke', '#27ae60');
h1.setAttribute('stroke-width', '2');
h1.setAttribute('stroke-dasharray', '5,5');
g.appendChild(h1);

const h2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
h2.setAttribute('x1', width - 50);
h2.setAttribute('y1', '150');
h2.setAttribute('x2', width - 50);
h2.setAttribute('y2', '180');
h2.setAttribute('stroke', '#e74c3c');
h2.setAttribute('stroke-width', '2');
h2.setAttribute('stroke-dasharray', '5,5');
g.appendChild(h2);

// Labels
const label1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
label1.setAttribute('x', '55');
label1.setAttribute('y', '25');
label1.setAttribute('fill', '#27ae60');
label1.setAttribute('font-size', '12');
label1.textContent = 'Δh = ' + delta_h.toFixed(1) + 'm';
g.appendChild(label1);

const label2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
label2.setAttribute('x', width - 100);
label2.setAttribute('y', '145');
label2.setAttribute('fill', '#e74c3c');
label2.setAttribute('font-size', '12');
label2.textContent = 'Flow Path';
g.appendChild(label2);

svg.appendChild(g);
}

// Utility Functions
function resetToDefault() {
document.getElementById("gamma_sat").value = "20";
document.getElementById("gamma_w").value = "9.81";
document.getElementById("delta_h").value = "8.5";
document.getElementById("delta_h_slider").value = "8.5";
document.getElementById("flow_path").value = "12";
document.getElementById("area").value = "1";
document.getElementById("conductivity").value = "0.001";

// Reset results
document.getElementById("iActual").textContent = "-";
document.getElementById("iCritical").textContent = "-";
document.getElementById("fsValue").textContent = "-";
document.getElementById("flowRate").textContent = "-";
document.getElementById("safetyStatus").textContent = "Pending";
document.getElementById("safetyStatus").className = "status-badge status-pending";

// Reset charts
updateSafetyGauge(0);
updateGradientChart(0, 0, 0);

// Reset recommendations
document.getElementById("recommendations").innerHTML =
'<h4><i class="fas fa-lightbulb"></i> Recommendations</h4>' +
'<p>Enter parameters and click "Calculate" to see recommendations.</p>';
}

function setupEventListeners() {
// Link slider with input
const dhSlider = document.getElementById("delta_h_slider");
const dhInput = document.getElementById("delta_h");

dhSlider.addEventListener("input", () => {
dhInput.value = dhSlider.value;
document.getElementById("deltaHValue").textContent = dhSlider.value;
if (dhInput === document.activeElement) return;
calculateSafetyFactor();
});

dhInput.addEventListener("input", () => {
dhSlider.value = dhInput.value;
document.getElementById("deltaHValue").textContent = dhInput.value;
calculateSafetyFactor();
});

// Recalculate on any input change
const inputs = document.querySelectorAll('.input-group input');
inputs.forEach(input => {
input.addEventListener('change', calculateSafetyFactor);
});

// Sensitivity slider
const sensitivitySlider = document.getElementById("sensitivitySlider");
sensitivitySlider.addEventListener("input", () => {
document.getElementById("delta_h").value = sensitivitySlider.value;
document.getElementById("delta_h_slider").value = sensitivitySlider.value;
calculateSafetyFactor();
});
}

function setupModal() {
const reportBtn = document.querySelector('a[href="#report"]');
const modal = document.getElementById("reportModal");
const closeBtn = document.querySelector(".modal-close");

reportBtn.addEventListener("click", (e) => {
e.preventDefault();
modal.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
modal.style.display = "none";
});

window.addEventListener("click", (e) => {
if (e.target === modal) {
modal.style.display = "none";
}
});
}

function generatePDFReport() {
const fs = parseFloat(document.getElementById("fsValue").textContent);
const status = document.getElementById("safetyStatus").textContent;

// In a real implementation, you would use a PDF generation library like jsPDF
alert("PDF Report Generated!\n\nSafety Factor: " + fs + "\nStatus: " + status +
"\n\n(Note: In a real implementation, this would generate a detailed PDF report with all inputs, results, and charts)");

// Close modal
document.getElementById("reportModal").style.display = "none";
}

// Initialize calculation on load
window.addEventListener('load', () => {
calculateSafetyFactor();
});
