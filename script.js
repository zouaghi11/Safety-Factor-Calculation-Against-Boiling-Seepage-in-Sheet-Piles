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
    setupExamplePresets();
    
    // Modal functionality
    setupModal();
    
    // Load saved calculation if exists
    if (localStorage.getItem('last_calculation')) {
        setTimeout(() => {
            if (confirm('Load previously saved calculation?')) {
                loadSavedCalculation();
            }
        }, 1000);
    }
    
    // Add interactive example to theory page
    if (document.querySelector('.example-case')) {
        makeExampleInteractive();
    }
});

let safetyGaugeChart = null;
let gradientChart = null;
let sensitivityChart = null;
let currentChartType = 'bar';

// Example presets
const examplePresets = {
    typical_sand: {
        gamma_sat: 19,
        gamma_w: 9.81,
        delta_h: 8.5,
        flow_path: 12,
        area: 1,
        conductivity: 0.001,
        description: "Typical sand with moderate hydraulic head"
    },
    critical_condition: {
        gamma_sat: 17,
        gamma_w: 9.81,
        delta_h: 15,
        flow_path: 8,
        area: 1,
        conductivity: 0.01,
        description: "Critical condition with high head and low flow path"
    },
    safe_design: {
        gamma_sat: 21,
        gamma_w: 9.81,
        delta_h: 5,
        flow_path: 15,
        area: 1,
        conductivity: 0.0001,
        description: "Safe design with conservative parameters"
    },
    clay_soil: {
        gamma_sat: 18,
        gamma_w: 9.81,
        delta_h: 6,
        flow_path: 10,
        area: 1,
        conductivity: 0.000001,
        description: "Clay soil with low permeability"
    }
};

// Input validation
function validateInputs() {
    const gamma_sat = parseFloat(document.getElementById("gamma_sat").value);
    const gamma_w = parseFloat(document.getElementById("gamma_w").value);
    const delta_h = parseFloat(document.getElementById("delta_h").value);
    const flow_path = parseFloat(document.getElementById("flow_path").value);
    
    const errors = [];
    
    // Clear previous error states
    document.querySelectorAll('.input-group').forEach(group => {
        group.classList.remove('error', 'warning');
        const errorMsg = group.querySelector('.error-message');
        if (errorMsg) errorMsg.style.display = 'none';
    });
    
    // Basic validation
    if (isNaN(gamma_sat) || gamma_sat <= 0) {
        errors.push({id: 'gamma_sat', msg: 'γ_sat must be a positive number'});
    }
    if (isNaN(gamma_w) || gamma_w <= 0) {
        errors.push({id: 'gamma_w', msg: 'γ_w must be a positive number'});
    }
    if (isNaN(delta_h) || delta_h <= 0) {
        errors.push({id: 'delta_h', msg: 'Δh must be a positive number'});
    }
    if (isNaN(flow_path) || flow_path <= 0) {
        errors.push({id: 'flow_path', msg: 'Flow path (L) must be a positive number'});
    }
    
    // Advanced validation
    if (!isNaN(gamma_sat) && !isNaN(gamma_w) && gamma_sat <= gamma_w) {
        errors.push({id: 'gamma_sat', msg: 'γ_sat must be greater than γ_w to prevent soil buoyancy'});
    }
    if (!isNaN(gamma_sat) && (gamma_sat < 15 || gamma_sat > 25)) {
        errors.push({id: 'gamma_sat', msg: 'γ_sat is outside typical range (15-25 kN/m³)'});
    }
    if (!isNaN(flow_path) && flow_path < delta_h * 0.5) {
        errors.push({id: 'flow_path', msg: 'Flow path is very short compared to head difference'});
    }
    
    // Show errors
    errors.forEach(error => {
        const input = document.getElementById(error.id);
        if (!input) return;
        
        const inputGroup = input.closest('.input-group');
        inputGroup.classList.add('error');
        
        let errorMsg = inputGroup.querySelector('.error-message');
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            inputGroup.appendChild(errorMsg);
        }
        errorMsg.textContent = error.msg;
        errorMsg.style.display = 'block';
    });
    
    return errors.length === 0;
}

// Hydraulic calculations
function calculateSafetyFactor() {
    // Validate inputs first
    if (!validateInputs()) {
        return;
    }

    // Get input values
    const gamma_sat = parseFloat(document.getElementById("gamma_sat").value);
    const gamma_w = parseFloat(document.getElementById("gamma_w").value);
    const delta_h = parseFloat(document.getElementById("delta_h").value);
    const flow_path = parseFloat(document.getElementById("flow_path").value);
    const area = parseFloat(document.getElementById("area").value);
    const conductivity = parseFloat(document.getElementById("conductivity").value);

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
    
    // Update diagram
    drawSheetPileDiagram(fs);
    
    // Save calculation
    saveCalculation();
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
                    <li>Consider increasing flow path length by ${(flow_path * 0.3).toFixed(1)} m</li>
                    <li>Monitor hydraulic heads regularly</li>
                    <li>Implement drainage measures if possible</li>
                    <li>Consider using denser backfill material (γ_sat > 20 kN/m³)</li>
                </ul>
            </div>
        `;
    } else {
        html += `
            <div class="recommendation-item">
                <i class="fas fa-exclamation-circle text-danger"></i>
                <strong>Structure is unsafe - Immediate action required!</strong>
                <ul>
                    <li><strong>Increase flow path length by ${(flow_path * 0.5).toFixed(1)} m minimum</strong></li>
                    <li>Install drainage system to reduce hydraulic head by ${(delta_h * 0.4).toFixed(1)} m</li>
                    <li>Consider sheet pile extension or additional cutoff walls</li>
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
            <p><strong>Actual Gradient (i_actual):</strong> ${i_actual.toFixed(4)}</p>
            <p><strong>Critical Gradient (i_critical):</strong> ${i_critical.toFixed(4)}</p>
            <p><strong>Safety Margin:</strong> ${(fs - 1).toFixed(3)}</p>
            <p><strong>Required L for FS=1.5:</strong> ${(delta_h / (i_critical / 1.5)).toFixed(1)} m</p>
        </div>
    `;

    recommendations.innerHTML = html;
}

// Chart Functions
function initializeCharts() {
    // Safety Gauge Chart
    const gaugeCtx = document.getElementById('safetyGauge')?.getContext('2d');
    if (gaugeCtx) {
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
    }

    // Gradient Chart
    const gradientCtx = document.getElementById('gradientChart')?.getContext('2d');
    if (gradientCtx) {
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
    }

    // Sensitivity Chart
    const sensitivityCtx = document.getElementById('sensitivityChart')?.getContext('2d');
    if (sensitivityCtx) {
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
}

function updateSafetyGauge(fs) {
    if (!safetyGaugeChart) return;
    
    const normalizedValue = Math.min(Math.max(fs, 0), 2) / 2 * 100;

    safetyGaugeChart.data.datasets[0].data = [normalizedValue, 100 - normalizedValue];
    safetyGaugeChart.data.datasets[0].backgroundColor = [
        fs >= 1.5 ? '#27ae60' : fs >= 1.0 ? '#f39c12' : '#e74c3c',
        '#ecf0f1'
    ];
    safetyGaugeChart.update();
}

function updateGradientChart(i_actual, i_critical, fs) {
    if (!gradientChart) return;
    
    if (currentChartType === 'bar') {
        gradientChart.data.datasets[0].data = [i_actual, i_critical];
    }
    gradientChart.update();
}

function toggleChartType() {
    if (!gradientChart) return;
    
    currentChartType = currentChartType === 'bar' ? 'radar' : 'bar';
    gradientChart.config.type = currentChartType;
    gradientChart.update();
}

function updateSensitivityAnalysis(gamma_sat, gamma_w, flow_path) {
    if (!sensitivityChart) return;
    
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

    // Update current value marker
    sensitivityChart.options.plugins.annotation.annotations.point1 = {
        type: 'line',
        xMin: delta_h_values.indexOf(current_dh.toFixed(1)),
        xMax: delta_h_values.indexOf(current_dh.toFixed(1)),
        borderColor: '#2c3e50',
        borderWidth: 2,
        borderDash: [3, 3],
        label: {
            display: true,
            content: 'Current Value',
            position: 'top',
            backgroundColor: 'rgba(44, 62, 80, 0.8)',
            color: 'white'
        }
    };

    sensitivityChart.update();
}

// Sheet Pile Diagram
function drawSheetPileDiagram(fs = 0) {
    const svg = document.getElementById('sheetPileDiagram');
    if (!svg) return;
    
    // Get current values
    const delta_h = parseFloat(document.getElementById("delta_h").value) || 8.5;
    const flow_path = parseFloat(document.getElementById("flow_path").value) || 12;
    const gamma_sat = parseFloat(document.getElementById("gamma_sat").value) || 20;
    const gamma_w = parseFloat(document.getElementById("gamma_w").value) || 9.81;
    
    // Clear SVG
    svg.innerHTML = '';
    
    const width = svg.clientWidth || 400;
    const height = 250;
    
    // Set SVG dimensions
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', width.toString());
    bg.setAttribute('height', height.toString());
    bg.setAttribute('fill', 'var(--body-bg)');
    g.appendChild(bg);
    
    // Soil layers
    const soil = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    soil.setAttribute('x', '0');
    soil.setAttribute('y', '100');
    soil.setAttribute('width', width.toString());
    soil.setAttribute('height', (height - 100).toString());
    soil.setAttribute('fill', '#8B7355');
    soil.setAttribute('opacity', '0.8');
    g.appendChild(soil);
    
    // Sheet pile
    const pileX = width * 0.4;
    const sheetPile = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    sheetPile.setAttribute('x', pileX.toString());
    sheetPile.setAttribute('y', '0');
    sheetPile.setAttribute('width', '8');
    sheetPile.setAttribute('height', height.toString());
    sheetPile.setAttribute('fill', '#6c757d');
    g.appendChild(sheetPile);
    
    // Water level on left side (upstream)
    const waterLevel = 100 - (delta_h / 20) * 40;
    const waterLeft = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    waterLeft.setAttribute('x', '0');
    waterLeft.setAttribute('y', waterLevel.toString());
    waterLeft.setAttribute('width', pileX.toString());
    waterLeft.setAttribute('height', (height - waterLevel).toString());
    waterLeft.setAttribute('fill', 'rgba(52, 152, 219, 0.3)');
    g.appendChild(waterLeft);
    
    // Water level on right side (downstream)
    const waterRight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    waterRight.setAttribute('x', (pileX + 8).toString());
    waterRight.setAttribute('y', (waterLevel + delta_h/2).toString());
    waterRight.setAttribute('width', (width - pileX - 8).toString());
    waterRight.setAttribute('height', (height - waterLevel - delta_h/2).toString());
    waterRight.setAttribute('fill', 'rgba(52, 152, 219, 0.2)');
    g.appendChild(waterRight);
    
    // Flow arrows
    const arrowCount = 5;
    const arrowSpacing = (width - pileX - 8) / (arrowCount + 1);
    
    for (let i = 0; i < arrowCount; i++) {
        const arrowX = pileX + 8 + arrowSpacing * (i + 1);
        const arrowY = waterLevel + 30 + i * 20;
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', `M${arrowX-15},${arrowY} L${arrowX},${arrowY} L${arrowX-5},${arrowY-5} M${arrowX},${arrowY} L${arrowX-5},${arrowY+5}`);
        arrow.setAttribute('stroke', '#3498db');
        arrow.setAttribute('stroke-width', '2');
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('class', 'flow-arrow');
        arrow.style.animation = `flow 2s ${i * 0.3}s infinite linear`;
        g.appendChild(arrow);
    }
    
    // Head difference lines
    const h1Line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    h1Line.setAttribute('x1', '30');
    h1Line.setAttribute('y1', waterLevel.toString());
    h1Line.setAttribute('x2', '30');
    h1Line.setAttribute('y2', '100');
    h1Line.setAttribute('stroke', '#27ae60');
    h1Line.setAttribute('stroke-width', '2');
    h1Line.setAttribute('stroke-dasharray', '5,5');
    g.appendChild(h1Line);
    
    const h2Line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    h2Line.setAttribute('x1', width - 30);
    h2Line.setAttribute('y1', (waterLevel + delta_h/2).toString());
    h2Line.setAttribute('x2', width - 30);
    h2Line.setAttribute('y2', '100');
    h2Line.setAttribute('stroke', '#e74c3c');
    h2Line.setAttribute('stroke-width', '2');
    h2Line.setAttribute('stroke-dasharray', '5,5');
    g.appendChild(h2Line);
    
    // Labels
    const label1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label1.setAttribute('x', '35');
    label1.setAttribute('y', (waterLevel - 5).toString());
    label1.setAttribute('fill', '#27ae60');
    label1.setAttribute('font-size', '12');
    label1.setAttribute('font-weight', '600');
    label1.textContent = `Δh = ${delta_h.toFixed(1)} m`;
    g.appendChild(label1);
    
    const label2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label2.setAttribute('x', width - 100);
    label2.setAttribute('y', '90');
    label2.setAttribute('fill', '#e74c3c');
    label2.setAttribute('font-size', '12');
    label2.setAttribute('font-weight', '600');
    label2.textContent = `L = ${flow_path.toFixed(1)} m`;
    g.appendChild(label2);
    
    // Safety factor indicator
    const fsColor = fs >= 1.5 ? '#27ae60' : fs >= 1.0 ? '#f39c12' : '#e74c3c';
    const fsLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    fsLabel.setAttribute('x', (width / 2).toString());
    fsLabel.setAttribute('y', '30');
    fsLabel.setAttribute('fill', fsColor);
    fsLabel.setAttribute('font-size', '14');
    fsLabel.setAttribute('font-weight', 'bold');
    fsLabel.setAttribute('text-anchor', 'middle');
    fsLabel.textContent = `FS = ${fs.toFixed(2)}`;
    g.appendChild(fsLabel);
    
    svg.appendChild(g);
}

// Example presets
function setupExamplePresets() {
    const presetsContainer = document.querySelector('.example-presets');
    if (!presetsContainer) return;
    
    Object.entries(examplePresets).forEach(([key, preset]) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerHTML = `<i class="fas fa-${key === 'typical_sand' ? 'sand' : key === 'critical_condition' ? 'exclamation-triangle' : key === 'safe_design' ? 'shield-alt' : 'layer-group'}"></i> ${preset.description.split(' ')[0]}`;
        btn.title = preset.description;
        btn.onclick = () => loadExample(key);
        presetsContainer.appendChild(btn);
    });
}

function loadExample(presetName) {
    const preset = examplePresets[presetName];
    if (!preset) return;
    
    document.getElementById("gamma_sat").value = preset.gamma_sat;
    document.getElementById("gamma_w").value = preset.gamma_w;
    document.getElementById("delta_h").value = preset.delta_h;
    document.getElementById("delta_h_slider").value = preset.delta_h;
    document.getElementById("flow_path").value = preset.flow_path;
    document.getElementById("area").value = preset.area;
    document.getElementById("conductivity").value = preset.conductivity;
    
    // Update slider display
    document.getElementById("deltaHValue").textContent = preset.delta_h;
    
    // Calculate
    calculateSafetyFactor();
    
    // Show notification
    showNotification(`Loaded: ${preset.description}`, 'success');
}

// Save/Load functionality
function saveCalculation() {
    const data = {
        inputs: {
            gamma_sat: document.getElementById("gamma_sat").value,
            gamma_w: document.getElementById("gamma_w").value,
            delta_h: document.getElementById("delta_h").value,
            flow_path: document.getElementById("flow_path").value,
            area: document.getElementById("area").value,
            conductivity: document.getElementById("conductivity").value
        },
        results: {
            fs: document.getElementById("fsValue").textContent,
            status: document.getElementById("safetyStatus").textContent,
            timestamp: new Date().toISOString()
        }
    };
    
    localStorage.setItem('last_calculation', JSON.stringify(data));
}

function loadSavedCalculation() {
    const saved = localStorage.getItem('last_calculation');
    if (!saved) {
        showNotification('No saved calculation found', 'warning');
        return;
    }
    
    try {
        const data = JSON.parse(saved);
        
        // Load inputs
        document.getElementById("gamma_sat").value = data.inputs.gamma_sat || "20";
        document.getElementById("gamma_w").value = data.inputs.gamma_w || "9.81";
        document.getElementById("delta_h").value = data.inputs.delta_h || "8.5";
        document.getElementById("delta_h_slider").value = data.inputs.delta_h || "8.5";
        document.getElementById("flow_path").value = data.inputs.flow_path || "12";
        document.getElementById("area").value = data.inputs.area || "1";
        document.getElementById("conductivity").value = data.inputs.conductivity || "0.001";
        
        // Update slider display
        document.getElementById("deltaHValue").textContent = data.inputs.delta_h || "8.5";
        
        // Calculate
        calculateSafetyFactor();
        
        showNotification('Loaded saved calculation', 'success');
    } catch (error) {
        showNotification('Error loading saved data', 'error');
        console.error('Load error:', error);
    }
}

function clearSavedCalculation() {
    localStorage.removeItem('last_calculation');
    showNotification('Saved calculation cleared', 'success');
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
    if (safetyGaugeChart) updateSafetyGauge(0);
    if (gradientChart) updateGradientChart(0, 0, 0);
    
    // Reset diagram
    drawSheetPileDiagram(0);

    // Reset recommendations
    const recommendations = document.getElementById("recommendations");
    if (recommendations) {
        recommendations.innerHTML =
            '<h4><i class="fas fa-lightbulb"></i> Recommendations</h4>' +
            '<p>Enter parameters and click "Calculate" to see recommendations.</p>';
    }
    
    // Clear saved calculation
    localStorage.removeItem('last_calculation');
}

function setupEventListeners() {
    // Link slider with input
    const dhSlider = document.getElementById("delta_h_slider");
    const dhInput = document.getElementById("delta_h");

    if (dhSlider && dhInput) {
        dhSlider.addEventListener("input", () => {
            dhInput.value = dhSlider.value;
            document.getElementById("deltaHValue").textContent = dhSlider.value;
            calculateSafetyFactor();
        });

        dhInput.addEventListener("input", () => {
            dhSlider.value = dhInput.value;
            document.getElementById("deltaHValue").textContent = dhInput.value;
            calculateSafetyFactor();
        });
    }

    // Recalculate on any input change
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        input.addEventListener('change', calculateSafetyFactor);
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') calculateSafetyFactor();
        });
    });
}

function setupModal() {
    const reportBtn = document.querySelector('a[href="#report"]');
    const modal = document.getElementById("reportModal");
    const closeBtn = document.querySelector(".modal-close");

    if (reportBtn && modal) {
        reportBtn.addEventListener("click", (e) => {
            e.preventDefault();
            modal.style.display = "flex";
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    if (modal) {
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    }
}

function generatePDFReport() {
    const fs = parseFloat(document.getElementById("fsValue").textContent);
    const status = document.getElementById("safetyStatus").textContent;
    
    // Simple HTML report generation
    const reportContent = `
        <html>
        <head>
            <title>Sheet Pile Safety Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #2c3e50; }
                .section { margin: 20px 0; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Sheet Pile Safety Analysis Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            
            <div class="section">
                <h2>Input Parameters</h2>
                <table>
                    <tr><th>Parameter</th><th>Value</th><th>Unit</th></tr>
                    <tr><td>γ_sat (Saturated Unit Weight)</td><td>${document.getElementById("gamma_sat").value}</td><td>kN/m³</td></tr>
                    <tr><td>γ_w (Unit Weight of Water)</td><td>${document.getElementById("gamma_w").value}</td><td>kN/m³</td></tr>
                    <tr><td>Δh (Head Difference)</td><td>${document.getElementById("delta_h").value}</td><td>m</td></tr>
                    <tr><td>L (Flow Path Length)</td><td>${document.getElementById("flow_path").value}</td><td>m</td></tr>
                </table>
            </div>
            
            <div class="section">
                <h2>Results</h2>
                <table>
                    <tr><th>Result</th><th>Value</th><th>Status</th></tr>
                    <tr><td>Safety Factor (FS)</td><td>${fs}</td><td><strong>${status}</strong></td></tr>
                    <tr><td>Actual Gradient (i_actual)</td><td>${document.getElementById("iActual").textContent}</td><td>-</td></tr>
                    <tr><td>Critical Gradient (i_critical)</td><td>${document.getElementById("iCritical").textContent}</td><td>-</td></tr>
                </table>
            </div>
            
            <div class="section">
                <h2>Recommendations</h2>
                <p>${document.querySelector(".recommendation-item strong")?.textContent || "Enter parameters to see recommendations"}</p>
            </div>
        </body>
        </html>
    `;
    
    // Open report in new window for printing
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportContent);
    reportWindow.document.close();
    
    // Close modal
    document.getElementById("reportModal").style.display = "none";
    
    showNotification('Report generated in new window', 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Interactive example for theory page
function makeExampleInteractive() {
    const exampleSection = document.querySelector('.example-case');
    if (!exampleSection) return;
    
    const existingInteractive = exampleSection.querySelector('.interactive-example');
    if (existingInteractive) return;
    
    const interactiveDiv = document.createElement('div');
    interactiveDiv.className = 'interactive-example';
    interactiveDiv.innerHTML = `
        <h4><i class="fas fa-sliders-h"></i> Try Different Values:</h4>
        <div class="example-controls">
            <div class="control-group">
                <label>γ_sat (kN/m³):</label>
                <input type="range" min="16" max="22" step="0.1" value="20" id="ex-gamma_sat">
                <span id="ex-gamma_sat-value">20</span>
            </div>
            <div class="control-group">
                <label>Δh (m):</label>
                <input type="range" min="5" max="15" step="0.1" value="8.5" id="ex-delta_h">
                <span id="ex-delta_h-value">8.5</span>
            </div>
            <div class="control-group">
                <label>L (m):</label>
                <input type="range" min="8" max="20" step="0.1" value="12" id="ex-flow_path">
                <span id="ex-flow_path-value">12</span>
            </div>
        </div>
        <div class="live-results">
            <p>i_actual = <span id="ex-i_actual">0.708</span></p>
            <p>i_critical = <span id="ex-i_critical">1.039</span></p>
            <p><strong>FS = <span id="ex-fs">1.47</span></strong></p>
        </div>
    `;
    
    exampleSection.appendChild(interactiveDiv);
    
    // Add event listeners
    ['ex-gamma_sat', 'ex-delta_h', 'ex-flow_path'].forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(`${id}-value`);
        
        if (slider && valueSpan) {
            slider.addEventListener('input', () => {
                valueSpan.textContent = slider.value;
                updateExampleCalculation();
            });
        }
    });
    
    updateExampleCalculation();
}

function updateExampleCalculation() {
    const gamma_sat = parseFloat(document.getElementById('ex-gamma_sat')?.value || 20);
    const gamma_w = 9.81;
    const delta_h = parseFloat(document.getElementById('ex-delta_h')?.value || 8.5);
    const flow_path = parseFloat(document.getElementById('ex-flow_path')?.value || 12);
    
    const i_actual = delta_h / flow_path;
    const i_critical = (gamma_sat - gamma_w) / gamma_w;
    const fs = i_critical / i_actual;
    
    const iActualElem = document.getElementById('ex-i_actual');
    const iCriticalElem = document.getElementById('ex-i_critical');
    const fsElem = document.getElementById('ex-fs');
    
    if (iActualElem) iActualElem.textContent = i_actual.toFixed(3);
    if (iCriticalElem) iCriticalElem.textContent = i_critical.toFixed(3);
    if (fsElem) fsElem.textContent = fs.toFixed(2);
}

// Initialize calculation on load
window.addEventListener('load', () => {
    calculateSafetyFactor();
});

// Export functions for global access
window.calculateSafetyFactor = calculateSafetyFactor;
window.resetToDefault = resetToDefault;
window.toggleChartType = toggleChartType;
window.generatePDFReport = generatePDFReport;
window.loadExample = loadExample;
window.loadSavedCalculation = loadSavedCalculation;
window.clearSavedCalculation = clearSavedCalculation;
window.saveCalculation = saveCalculation;
