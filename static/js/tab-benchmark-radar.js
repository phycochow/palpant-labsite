/**
 * Radar chart visualization for benchmark tab
 * Based on the implementation from testcase.html
 */

// Create namespace if it doesn't exist
window.CMPortal = window.CMPortal || {};
CMPortal.benchmarkRadar = {};

// Flag to track initialization
CMPortal.benchmarkRadar.initialized = false;

// Store chart instance for later manipulation
CMPortal.benchmarkRadar.chart = null;

// Store reference to current reference protocol index
CMPortal.benchmarkRadar.currentRefIndex = 0;

// Store the benchmark data
CMPortal.benchmarkRadar.benchmarkData = null;

// Indicators list with number of quantile rings for each
CMPortal.benchmarkRadar.indicators = [
  { label: "Sarcomere Length (um)", rings: 5 },
  { label: "Cell Area (um²)", rings: 3 },
  { label: "T-tubule Structure (Found)", rings: 2 },
  { label: "Contractile Force (mN)", rings: 5 },
  { label: "Contractile Stress (mN/mm²)", rings: 4 },
  { label: "Contraction Upstroke Velocity (um/s)", rings: 4 },
  { label: "Calcium Flux Amplitude (F/F0)", rings: 5 },
  { label: "Time to Calcium Flux Peak (ms)", rings: 5 },
  { label: "Time from Calcium Peak to Relaxation (ms)", rings: 2 },
  { label: "Conduction Velocity from Calcium Imaging (cm/s)", rings: 3 },
  { label: "Action Potential Conduction Velocity (cm/s)", rings: 4 },
  { label: "Action Potential Amplitude (mV)", rings: 4 },
  { label: "Resting Membrane Potential (mV)", rings: 5 },
  { label: "Beat Rate (bpm)", rings: 5 },
  { label: "Max Capture Rate of Paced CMs (Hz)", rings: 2 },
  { label: "MYH7 Percentage (MYH6)", rings: 2 },
  { label: "MYL2 Percentage (MYL7)", rings: 2 },
  { label: "TNNI3 Percentage (TNNI1)", rings: 2 },
];

// Initialize the radar chart visualization
CMPortal.benchmarkRadar.init = function(benchmarkData) {
  // Store the benchmark data
  CMPortal.benchmarkRadar.benchmarkData = benchmarkData;
  
  // Reset current reference index
  CMPortal.benchmarkRadar.currentRefIndex = 0;
  
  // Check if already initialized
  if (CMPortal.benchmarkRadar.initialized) {
    CMPortal.benchmarkRadar.updateChart();
    return;
  }
  
  // Create the container for the radar chart
  CMPortal.benchmarkRadar.createRadarContainer();
  
  // Load Chart.js library if not already loaded
  CMPortal.benchmarkRadar.loadChartJs(function() {
    // Initialize the radar chart
    CMPortal.benchmarkRadar.initChart();
    CMPortal.benchmarkRadar.initialized = true;
  });
};

// Load Chart.js library
CMPortal.benchmarkRadar.loadChartJs = function(callback) {
  // Check if Chart.js is already loaded
  if (window.Chart) {
    callback();
    return;
  }
  
  // Create script element for Chart.js
  const script = document.createElement('script');
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js";
  script.onload = callback;
  document.head.appendChild(script);
};

// Create the container for the radar chart
CMPortal.benchmarkRadar.createRadarContainer = function() {
  // Check if results container exists
  const resultsContainer = document.getElementById('benchmark-results-container');
  if (!resultsContainer) return;
  
  // Clear any existing content
  resultsContainer.innerHTML = '';
  
  // Create radar container
  const radarContainer = document.createElement('div');
  radarContainer.className = 'container';
  radarContainer.innerHTML = `
    <h1>Cardiomyocyte Maturity Analysis</h1>
    
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color your-protocol"></div><span>Your Protocol</span>
      </div>
      <div class="legend-item">
        <div class="legend-color reference"></div><span id="refLabel">Reference 1</span>
      </div>
    </div>
    
    <div class="chart-container">
      <canvas id="maturityChart"></canvas>
    </div>
    
    <div class="legend-custom">
      <div class="legend-row">
        <div class="legend-markers">
          <span class="legend-marker marker-pred-yours"></span>
          <span class="legend-marker marker-pred-ref"></span>
        </div>
        <div class="legend-label">Predicted Data</div>
      </div>
      <div class="legend-row">
        <div class="legend-markers">
          <span class="legend-marker marker-expt-yours"></span>
          <span class="legend-marker marker-expt-ref"></span>
        </div>
        <div class="legend-label">Experimental Data (Within Range)</div>
      </div>
      <div class="legend-row">
        <div class="legend-markers">
          <span class="legend-marker marker-exceeds-yours"></span>
          <span class="legend-marker marker-exceeds-ref"></span>
        </div>
        <div class="legend-label">Experimental Data (Exceeds Best Bound)</div>
      </div>
      <div class="legend-row">
        <div class="legend-markers">
          <span class="legend-marker marker-below-yours"></span>
          <span class="legend-marker marker-below-ref"></span>
        </div>
        <div class="legend-label">Experimental Data (Below Worst Bound)</div>
      </div>
    </div>
    
    <button id="regenerateBtn" class="btn">Next Reference</button>
    
    <div class="info-box">
      <strong>Chart Interpretation:</strong>
      Outer rings (higher values) = more adult-like; inner rings = more fetal-like.
      Each indicator has its own number of quantile bins (2–5).
    </div>
  `;
  
  // Add styles for the radar chart
  const style = document.createElement('style');
  style.textContent = `
    .container {
      max-width: 900px; margin: 0 auto;
      background: #fff; padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    h1 {
      text-align: center; color: #2c3e50;
      margin-bottom: 30px;
    }
    .chart-container {
      position: relative;
      height: 70vh; width: 80vw; max-width: 800px;
      margin: 0 auto;
    }
    .btn {
      background: #3498db; color: #fff; border: none;
      padding: 10px 20px; border-radius: 4px;
      cursor: pointer; font-size: 14px;
      margin: 20px auto; display: block;
      transition: background-color 0.3s;
    }
    .btn:hover { background: #2980b9; }
    .legend, .legend-custom {
      display: flex; justify-content: center; gap: 20px;
      margin-top: 10px; font-size: 14px; color: #2c3e50;
      flex-wrap: wrap;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-color {
      width: 20px; height: 20px; border-radius: 50%;
    }
    .your-protocol { 
      background: rgba(54,162,235,0.5); 
      border: 1px solid rgba(54,162,235,1); 
    }
    .reference { 
      background: rgba(255,99,132,0.5); 
      border: 1px solid rgba(255,99,132,1); 
    }
    .legend-custom {
      margin-top: 20px;
      margin-bottom: 20px;
      padding: 10px;
      border-radius: 4px;
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
    }
    .legend-row {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      width: 100%;
    }
    .legend-label {
      flex: 1;
      margin-left: 10px;
    }
    .legend-markers {
      display: flex;
      gap: 5px;
      width: 60px;
      justify-content: flex-end;
    }
    .legend-marker {
      display: inline-block; width: 12px; height: 12px;
      border-radius: 50%;
      vertical-align: middle;
    }
    /* Your Protocol Markers */
    .marker-pred-yours {
      background-color: #fff; border: 2px solid rgba(54,162,235,1);
    }
    .marker-expt-yours {
      background-color: rgba(30,120,190,1); border: none;
    }
    .marker-exceeds-yours {
      background-color: rgba(10,60,110,1); border: none;
    }
    .marker-below-yours {
      background-color: rgba(100,180,235,1); border: none;
    }
    /* Reference Markers */
    .marker-pred-ref {
      background-color: #fff; border: 2px solid rgba(255,99,132,1);
    }
    .marker-expt-ref {
      background-color: rgba(255,99,132,1); border: none;
    }
    .marker-exceeds-ref {
      background-color: rgba(180,50,80,1); border: none;
    }
    .marker-below-ref {
      background-color: rgba(255,170,192,1); border: none;
    }
    .info-box {
      background: #f1f8ff; border: 1px solid #cce5ff;
      border-radius: 4px; padding: 10px 15px;
      margin-top: 20px; font-size: 14px; color: #0c5460;
    }
  `;
  
  // Append elements to the results container
  resultsContainer.appendChild(style);
  resultsContainer.appendChild(radarContainer);
  
  // Add event listener for Next Reference button
  setTimeout(function() {
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', function() {
        CMPortal.benchmarkRadar.nextReference();
      });
    }
  }, 100);
};

// Initialize the radar chart
CMPortal.benchmarkRadar.initChart = function() {
  const ctx = document.getElementById('maturityChart');
  if (!ctx) return;
  
  // Custom radar plugin for drawing custom grid
  const customRadarPlugin = {
    id: 'customRadar',
    beforeDraw(chart) {
      const ctx = chart.ctx;
      const scale = chart.scales.r;
      const radius = scale.drawingArea;
      const cx = scale.xCenter, cy = scale.yCenter;
      ctx.save();
      CMPortal.benchmarkRadar.drawCustomGrid(ctx, cx, cy, radius);
      ctx.restore();
    }
  };
  
  // Create chart
  CMPortal.benchmarkRadar.chart = new Chart(ctx, {
    type: 'radar',
    data: CMPortal.benchmarkRadar.prepareChartData(),
    options: {
      scales: {
        r: {
          min: 0, max: 1,
          ticks: { display: false },
          pointLabels: { font: { size: 11 } },
          grid: { display: false },
          angleLines: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const idx = ctx.dataIndex;
              const ind = CMPortal.benchmarkRadar.indicators[idx];
              const isRef = ctx.dataset.label.includes("Reference");
              
              let dataEntry, qv, flag, kind;
              
              if (isRef) {
                const refIdx = CMPortal.benchmarkRadar.currentRefIndex;
                const refData = CMPortal.benchmarkRadar.benchmarkData[refIdx + 1][1]; // +1 to skip user protocol
                const indLabel = ind.label;
                
                if (refData[indLabel]) {
                  [qv, flag] = refData[indLabel];
                  kind = CMPortal.benchmarkRadar.getFlagDescription(flag);
                  return `Reference: ${kind}: ${qv} of ${ind.rings}`;
                }
                return `Reference: No data for ${indLabel}`;
              } else {
                const userData = CMPortal.benchmarkRadar.benchmarkData[0][1];
                const indLabel = ind.label;
                
                if (userData[indLabel]) {
                  [qv, flag] = userData[indLabel];
                  kind = CMPortal.benchmarkRadar.getFlagDescription(flag);
                  return `Your Protocol: ${kind}: ${qv} of ${ind.rings}`;
                }
                return `Your Protocol: No data for ${indLabel}`;
              }
            }
          }
        }
      },
      elements: { line: { tension: 0.1 } },
      responsive: true, 
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
      transitions: {
        active: {
          animation: {
            duration: 800
          }
        }
      }
    },
    plugins: [customRadarPlugin]
  });
};

// Draw custom grid for radar chart
CMPortal.benchmarkRadar.drawCustomGrid = function(ctx, cx, cy, radius) {
  const indicators = CMPortal.benchmarkRadar.indicators;
  const n = indicators.length;
  const angleStep = (Math.PI * 2) / n;

  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  // Draw spokes
  for (let i = 0; i < n; i++) {
    const ang = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.stroke();
  }

  // Draw alternating background
  for (let i = 0; i < n; i++) {
    const ang = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, ang - angleStep / 2, ang + angleStep / 2);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.02)';
    ctx.fill();
  }

  // Draw curved rings for each indicator
  indicators.forEach((ind, i) => {
    const baseAng = i * angleStep - Math.PI / 2;
    const startAng = baseAng - angleStep / 2, endAng = baseAng + angleStep / 2;
    for (let q = 0; q < ind.rings; q++) {
      const r = ((ind.rings - q) / ind.rings) * radius;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, endAng);
      ctx.stroke();
    }
  });
};

// Get styling for data points based on flag
CMPortal.benchmarkRadar.getDataPointStyling = function(flag, isReference) {
  // Base colors (updated with darker/more distinct shades)
  const blueBase = 'rgba(30,120,190,1)'; // Darker standard blue
  const redBase = 'rgba(255,99,132,1)';
  
  // Styles for your protocol (blue)
  const yourStyles = {
    0: { // Predicted data
      bg: 'rgba(255,255,255,1)',
      border: 'rgba(54,162,235,1)',
      radius: 6
    },
    1: { // Experimental data within range
      bg: blueBase,
      border: blueBase,
      radius: 6
    },
    3: { // Experimental data exceeds best bound
      bg: 'rgba(10,60,110,1)', // Much darker blue
      border: 'rgba(10,60,110,1)',
      radius: 7
    },
    4: { // Experimental data below worst bound
      bg: 'rgba(100,180,235,1)', // Lighter blue
      border: 'rgba(100,180,235,1)',
      radius: 7
    }
  };
  
  // Styles for reference (red)
  const refStyles = {
    0: { // Predicted data
      bg: 'rgba(255,255,255,1)',
      border: redBase,
      radius: 4
    },
    1: { // Experimental data within range
      bg: redBase,
      border: redBase,
      radius: 4
    },
    3: { // Experimental data exceeds best bound
      bg: 'rgba(180,50,80,1)', // Darker red
      border: 'rgba(180,50,80,1)',
      radius: 5
    },
    4: { // Experimental data below worst bound
      bg: 'rgba(255,170,192,1)', // Lighter red
      border: 'rgba(255,170,192,1)',
      radius: 5
    }
  };
  
  return isReference ? refStyles[flag] || refStyles[1] : yourStyles[flag] || yourStyles[1];
};

// Get description for flag values
CMPortal.benchmarkRadar.getFlagDescription = function(flag) {
  switch(Number(flag)) {
    case 0:
      return "Predicted Data";
    case 1:
      return "Experimental Data (Within Range)";
    case 3:
      return "Experimental Data (Exceeds Best Bound)";
    case 4:
      return "Experimental Data (Below Worst Bound)";
    default:
      return "Data";
  }
};

// Prepare chart data for visualization
CMPortal.benchmarkRadar.prepareChartData = function() {
  const indicators = CMPortal.benchmarkRadar.indicators;
  const benchmarkData = CMPortal.benchmarkRadar.benchmarkData;
  
  if (!benchmarkData || benchmarkData.length < 1) {
    return {
      labels: indicators.map(i => i.label),
      datasets: []
    };
  }
  
  // Get the user protocol (first entry in benchmark data)
  const [yourProtocolName, yourProtocolData] = benchmarkData[0];
  
  // Get the reference protocol (based on current reference index)
  let refProtocolName = 'No Reference';
  let refProtocolData = {};
  
  if (benchmarkData.length > 1) {
    const refIdx = Math.min(CMPortal.benchmarkRadar.currentRefIndex, benchmarkData.length - 2) + 1;
    [refProtocolName, refProtocolData] = benchmarkData[refIdx];
    
    // Update reference label
    const refLabel = document.getElementById('refLabel');
    if (refLabel) {
      refLabel.textContent = `Reference ${CMPortal.benchmarkRadar.currentRefIndex + 1}`;
    }
  }
  
  // Prepare your protocol data
  const yourData = [], yourBg = [], yourBorder = [], yourRadius = [];
  
  // Process your data
  indicators.forEach((ind) => {
    const label = ind.label;
    if (yourProtocolData[label]) {
      const [qv, flag] = yourProtocolData[label];
      // Convert qv to a numeric value for chart
      const qvNum = parseFloat(String(qv).replace('Q', ''));
      const ringPos = (ind.rings - (qvNum - 1)) / ind.rings;
      
      yourData.push(ringPos);
      
      const style = CMPortal.benchmarkRadar.getDataPointStyling(flag, false);
      yourBg.push(style.bg);
      yourBorder.push(style.border);
      yourRadius.push(style.radius);
    } else {
      // No data available for this indicator
      yourData.push(0);
      yourBg.push('rgba(0,0,0,0)');
      yourBorder.push('rgba(0,0,0,0)');
      yourRadius.push(0);
    }
  });
  
  // Prepare reference protocol data
  const refData = [], refBg = [], refBorder = [], refRadius = [];
  
  // Process reference data
  indicators.forEach((ind) => {
    const label = ind.label;
    if (refProtocolData[label]) {
      const [qv, flag] = refProtocolData[label];
      // Convert qv to a numeric value for chart
      const qvNum = parseFloat(String(qv).replace('Q', ''));
      const ringPos = (ind.rings - (qvNum - 1)) / ind.rings;
      
      refData.push(ringPos);
      
      const style = CMPortal.benchmarkRadar.getDataPointStyling(flag, true);
      refBg.push(style.bg);
      refBorder.push(style.border);
      refRadius.push(style.radius);
    } else {
      // No data available for this indicator
      refData.push(0);
      refBg.push('rgba(0,0,0,0)');
      refBorder.push('rgba(0,0,0,0)');
      refRadius.push(0);
    }
  });
  
  return {
    labels: indicators.map(i => i.label),
    datasets: [
      {
        label: 'Your Protocol',
        data: yourData,
        backgroundColor: 'rgba(54,162,235,0.3)',
        borderColor: 'rgba(54,162,235,1)',
        borderWidth: 2,
        pointBackgroundColor: yourBg,
        pointBorderColor: yourBorder,
        pointRadius: yourRadius,
        pointStyle: 'circle'
      },
      {
        label: `Reference ${CMPortal.benchmarkRadar.currentRefIndex + 1}`,
        data: refData,
        backgroundColor: 'rgba(255,99,132,0.3)',
        borderColor: 'rgba(255,99,132,1)',
        borderWidth: 2,
        pointBackgroundColor: refBg,
        pointBorderColor: refBorder,
        pointRadius: refRadius,
        pointStyle: 'circle'
      }
    ]
  };
};

// Move to next reference protocol
CMPortal.benchmarkRadar.nextReference = function() {
  // Update current reference index
  CMPortal.benchmarkRadar.currentRefIndex++;
  
  // Ensure index is within bounds
  const benchmarkData = CMPortal.benchmarkRadar.benchmarkData;
  if (benchmarkData && benchmarkData.length > 1) {
    // Wrap around if at the end
    if (CMPortal.benchmarkRadar.currentRefIndex >= benchmarkData.length - 1) {
      CMPortal.benchmarkRadar.currentRefIndex = 0;
    }
    
    // Update the chart
    CMPortal.benchmarkRadar.updateChart();
  }
};

// Update the chart with new data
CMPortal.benchmarkRadar.updateChart = function() {
  if (!CMPortal.benchmarkRadar.chart) return;
  
  // Get reference index
  const refIdx = CMPortal.benchmarkRadar.currentRefIndex;
  const benchmarkData = CMPortal.benchmarkRadar.benchmarkData;
  
  // Update the reference label
  const refLabel = document.getElementById('refLabel');
  if (refLabel) {
    refLabel.textContent = `Reference ${refIdx + 1}`;
  }
  
  // Prepare updated chart data
  const chartData = CMPortal.benchmarkRadar.prepareChartData();
  
  // Update chart datasets
  CMPortal.benchmarkRadar.chart.data.datasets = chartData.datasets;
  
  // Update chart
  CMPortal.benchmarkRadar.chart.update();
};