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
  
  // Create radar container
  const radarContainer = document.createElement('div');
  radarContainer.className = 'container';
  radarContainer.innerHTML = `
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color your-protocol"></div><span id="userProtocolLabel">Your Protocol</span>
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
  document.head.appendChild(style);
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

// Draw custom grid for radar chart
CMPortal.benchmarkRadar.drawCustomGrid = function(ctx, cx, cy, radius) {
  const n = CMPortal.benchmarkRadar.indicators.length;
  const angleStep = (Math.PI * 2) / n;

  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  // Spokes
  for (let i = 0; i < n; i++) {
    const ang = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.stroke();
  }

  // Alternating background
  for (let i = 0; i < n; i++) {
    const ang = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, ang - angleStep / 2, ang + angleStep / 2);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.02)';
    ctx.fill();
  }

  // Curved rings for each indicator's quantiles
  CMPortal.benchmarkRadar.indicators.forEach((ind, i) => {
    const baseAng = i * angleStep - Math.PI / 2;
    const startAng = baseAng - angleStep / 2;
    const endAng = baseAng + angleStep / 2;
    
    for (let q = 0; q < ind.rings; q++) {
      const r = ((ind.rings - q) / ind.rings) * radius;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, endAng);
      ctx.stroke();
    }
  });
};

// Custom radar plugin for Chart.js
CMPortal.benchmarkRadar.customRadarPlugin = function() {
  return {
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
};

// Get styling for data points based on flag value
CMPortal.benchmarkRadar.getDataPointStyling = function(flag, isReference) {
  // Default flag to 0 if not provided
  flag = parseInt(flag) || 0;
  
  // Base colors
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
  
  // Return the appropriate style based on flag and protocol type
  return isReference ? refStyles[flag] || refStyles[1] : yourStyles[flag] || yourStyles[1];
};

// Prepare chart data for the radar chart
CMPortal.benchmarkRadar.prepareChartData = function() {
  if (!CMPortal.benchmarkRadar.benchmarkData || CMPortal.benchmarkRadar.benchmarkData.length === 0) {
    console.error('No benchmark data available');
    return null;
  }
  
  // Get the user protocol data (first entry in benchmark data)
  const userProtocol = CMPortal.benchmarkRadar.benchmarkData[0];
  const userProtocolName = userProtocol[0];
  const userProtocolData = userProtocol[1];
  
  // Get the reference protocol data (based on current reference index)
  const refIndex = CMPortal.benchmarkRadar.currentRefIndex + 1; // +1 because index 0 is user protocol
  
  // Make sure the reference index is valid
  if (refIndex >= CMPortal.benchmarkRadar.benchmarkData.length) {
    // Wrap around to the first reference if needed
    CMPortal.benchmarkRadar.currentRefIndex = 0;
  }
  
  const referenceProtocol = CMPortal.benchmarkRadar.benchmarkData[refIndex] || CMPortal.benchmarkRadar.benchmarkData[1];
  const referenceProtocolName = referenceProtocol[0];
  const referenceProtocolData = referenceProtocol[1];
  
  // Prepare data arrays and styling for chart
  const yourData = [], yourBg = [], yourBorder = [], yourRadius = [];
  const refData = [], refBg = [], refBorder = [], refRadius = [];
  
  // Process your data
  CMPortal.benchmarkRadar.indicators.forEach(indicator => {
    const id = indicator.label;
    const rings = indicator.rings;
    
    // Get the user's data for this indicator
    const userValue = userProtocolData[id] || ['Q1', 0]; // Default to Q1 if not found
    const userQuantile = userValue[0];
    const userFlag = userValue[1];
    
    // Calculate the ring position (value from 0 to 1)
    const userQNum = parseFloat(userQuantile.replace('Q', ''));
    const userRingPos = (rings - (userQNum - 1)) / rings;
    
    // Add to your data arrays
    yourData.push(userRingPos);
    
    // Get styling based on flag
    const userStyle = CMPortal.benchmarkRadar.getDataPointStyling(userFlag, false);
    yourBg.push(userStyle.bg);
    yourBorder.push(userStyle.border);
    yourRadius.push(userStyle.radius);
    
    // Get the reference data for this indicator
    const refValue = referenceProtocolData[id] || ['Q1', 0]; // Default to Q1 if not found
    const refQuantile = refValue[0];
    const refFlag = refValue[1];
    
    // Calculate the ring position (value from 0 to 1)
    const refQNum = parseFloat(refQuantile.replace('Q', ''));
    const refRingPos = (rings - (refQNum - 1)) / rings;
    
    // Add to reference data arrays
    refData.push(refRingPos);
    
    // Get styling based on flag
    const refStyle = CMPortal.benchmarkRadar.getDataPointStyling(refFlag, true);
    refBg.push(refStyle.bg);
    refBorder.push(refStyle.border);
    refRadius.push(refStyle.radius);});
  
  // Return the prepared data
  return {
    labels: CMPortal.benchmarkRadar.indicators.map(i => i.label),
    datasets: [
      {
        label: userProtocolName,
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
        label: referenceProtocolName,
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

// Initialize the radar chart
CMPortal.benchmarkRadar.initChart = function() {
  const ctx = document.getElementById('maturityChart').getContext('2d');
  
  // Prepare the chart data
  const data = CMPortal.benchmarkRadar.prepareChartData();
  
  if (!data) {
    console.error('Failed to prepare chart data');
    return;
  }
  
  // Create the chart
  CMPortal.benchmarkRadar.chart = new Chart(ctx, {
    type: 'radar',
    data: data,
    options: {
      scales: {
        r: {
          min: 0, 
          max: 1,
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
            label(ctx) {
              const idx = ctx.dataIndex;
              const indicator = CMPortal.benchmarkRadar.indicators[idx];
              const isRef = ctx.dataset.label !== CMPortal.benchmarkRadar.benchmarkData[0][0];
              
              let dataArray;
              let protocolName;
              
              if (isRef) {
                const refIndex = CMPortal.benchmarkRadar.currentRefIndex + 1;
                const referenceProtocol = CMPortal.benchmarkRadar.benchmarkData[refIndex];
                dataArray = referenceProtocol[1][indicator.label] || ['?', 0];
                protocolName = referenceProtocol[0];
              } else {
                const userProtocol = CMPortal.benchmarkRadar.benchmarkData[0];
                dataArray = userProtocol[1][indicator.label] || ['?', 0];
                protocolName = userProtocol[0];
              }
              
              const [qv, flag] = dataArray;
              
              let kind = CMPortal.benchmarkRadar.getFlagDescription(flag);
              
              return `${protocolName}: ${kind}: ${qv} of ${indicator.rings} quantiles`;
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
    plugins: [CMPortal.benchmarkRadar.customRadarPlugin()]
  });

  // Update the protocol labels
  document.getElementById('userProtocolLabel').textContent = CMPortal.benchmarkRadar.benchmarkData[0][0] || 'Your Protocol';
  
  if (CMPortal.benchmarkRadar.benchmarkData.length > 1) {
    const refIndex = CMPortal.benchmarkRadar.currentRefIndex + 1;
    const referenceProtocol = CMPortal.benchmarkRadar.benchmarkData[refIndex];
    document.getElementById('refLabel').textContent = referenceProtocol[0];
  }
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
  const refIndex = CMPortal.benchmarkRadar.currentRefIndex;
  const benchmarkData = CMPortal.benchmarkRadar.benchmarkData;
  
  // Update the reference label
  const refLabel = document.getElementById('refLabel');
  if (refLabel && benchmarkData && benchmarkData.length > 1) {
    const referenceIndex = refIndex + 1;
    if (referenceIndex < benchmarkData.length) {
      refLabel.textContent = benchmarkData[referenceIndex][0];
    }
  }
  
  // Prepare updated chart data
  const chartData = CMPortal.benchmarkRadar.prepareChartData();
  
  // Update chart datasets
  if (chartData && CMPortal.benchmarkRadar.chart) {
    CMPortal.benchmarkRadar.chart.data.datasets = chartData.datasets;
    CMPortal.benchmarkRadar.chart.update();
  }
};

// Function to be called from tab-benchmark.js to visualize benchmark results
CMPortal.benchmarkRadar.visualizeResults = function(benchmarkData) {
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not available. Cannot create radar chart.');
    return;
  }
  
  // Check if the benchmark data is valid
  if (!benchmarkData || !Array.isArray(benchmarkData) || benchmarkData.length === 0) {
    console.error('Invalid benchmark data. Cannot create radar chart.');
    return;
  }
  
  // Initialize the radar chart
  CMPortal.benchmarkRadar.init(benchmarkData);
};