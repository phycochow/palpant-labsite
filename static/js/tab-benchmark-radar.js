/**
 * Radar chart visualization for benchmark tab
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
  { label: "Max Capture Rate of Paced CMs (Hz)", rings: 2 },
  { label: "Beat Rate (bpm)", rings: 5 },
  { label: "MYH7 Percentage (MYH6)", rings: 2 },
  { label: "MYL2 Percentage (MYL7)", rings: 2 },
  { label: "TNNI3 Percentage (TNNI1)", rings: 2 },
  { label: "Sarcomere Length (um)", rings: 5 },
];

// Define category information with colors and icons
CMPortal.benchmarkRadar.categories = {
  "Morphology": {
    color: "#1E40AF", // Royal Blue
    icon: "🧫",
    indicators: ["Sarcomere Length (um)", "Cell Area (um²)", "T-tubule Structure (Found)"]
  },
  "Contractile Function": {
    color: "#166534", // Forest Green
    icon: "💪",
    indicators: ["Contractile Force (mN)", "Contractile Stress (mN/mm²)", "Contraction Upstroke Velocity (um/s)"]
  },
  "Electrophysiology": {
    color: "#7E22CE", // Purple
    icon: "⚡",
    indicators: ["Action Potential Amplitude (mV)", "Resting Membrane Potential (mV)", 
                "Action Potential Conduction Velocity (cm/s)", "Max Capture Rate of Paced CMs (Hz)"]
  },
  "Calcium Handling": {
    color: "#C2410C", // Burnt Orange
    icon: "Ca²⁺",
    indicators: ["Calcium Flux Amplitude (F/F0)", "Time to Calcium Flux Peak (ms)", 
                "Time from Calcium Peak to Relaxation (ms)", "Conduction Velocity from Calcium Imaging (cm/s)"]
  },
  "Rhythmicity": {
    color: "#BE123C", // Crimson
    icon: "❤️",
    indicators: ["Beat Rate (bpm)"]
  },
  "Transcriptomic Markers": {
    color: "#0F766E", // Dark Teal
    icon: "🧬",
    indicators: ["MYH7 Percentage (MYH6)", "MYL2 Percentage (MYL7)", "TNNI3 Percentage (TNNI1)"]
  }
};

// Add helper function to get category for an indicator
CMPortal.benchmarkRadar.getCategoryInfo = function(indicatorLabel) {
  for (const [categoryName, category] of Object.entries(CMPortal.benchmarkRadar.categories)) {
    if (category.indicators.includes(indicatorLabel)) {
      return {
        name: categoryName,
        color: category.color,
        icon: category.icon
      };
    }
  }
  return {
    name: "Other",
    color: "#333333",
    icon: "📊"
  };
};

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

// Modify the createRadarContainer function to reposition the button
CMPortal.benchmarkRadar.createRadarContainer = function() {
  // Check if results container exists
  const resultsContainer = document.getElementById('benchmark-results-container');
  if (!resultsContainer) return;
  
  // Create radar container with updated layout
  const radarContainer = document.createElement('div');
  radarContainer.className = 'compact-container';
  
  // Build the category legend HTML
  let categoryLegendHtml = `
    <div class="category-legend">
      <h4>Categories:</h4>
      <div class="category-legend-items">
  `;
  
  // Add each category to the legend
  for (const [categoryName, category] of Object.entries(CMPortal.benchmarkRadar.categories)) {
    categoryLegendHtml += `
      <div class="category-item">
        <span class="category-icon">${category.icon}</span>
        <span class="category-name" style="color: ${category.color}">${categoryName}</span>
      </div>
    `;
  }
  
  categoryLegendHtml += `
      </div>
    </div>
  `;
  
  // Combine all HTML - IMPORTANT CHANGE: Remove the Next Reference button from the protocol-selector
  radarContainer.innerHTML = `
    <div class="protocol-selector">
      <div class="protocol-labels">
        <div class="legend-item">
          <div class="legend-color your-protocol"></div><span id="userProtocolLabel">Your Protocol</span>
          <span class="legend-marker marker-pred-yours"></span>
        </div>
        <div class="legend-item">
          <div class="legend-color reference"></div><span id="refLabel">Reference 1</span>
          <span class="legend-marker marker-pred-ref"></span>
        </div>
      </div>
      <div class="button-container">
        <button id="regenerateBtn" class="btn">Next Reference →</button>
      </div>
    </div>
    
    <div class="info-box-top">
      <strong>Chart Interpretation:</strong> Outer rings = more adult-like; inner rings = more fetal-like
    </div>

    <div class="radar-content">
      <div class="legend-panel">
        <h4>LEGEND:</h4>
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
        
        <!-- Add category legend below existing legend -->
        ${categoryLegendHtml}
      </div>
      
      <div class="chart-container">
        <canvas id="maturityChart"></canvas>
      </div>
    </div>
  `;
  
  // Append elements to the results container
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
    refRadius.push(refStyle.radius);
  });
  
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
  
  // Create the chart with improved animation configuration
  CMPortal.benchmarkRadar.chart = new Chart(ctx, {
    type: 'radar',
    data: data,
    options: {
      scales: {
        r: {
          min: 0, 
          max: 1,
          ticks: { display: false },
          pointLabels: { 
            font: { size: 12 },
            padding: 12, // Add padding to make more space for labels
            color: function(context) {
              // Get the indicator label
              const index = context.index;
              const indicatorLabel = CMPortal.benchmarkRadar.indicators[index].label;
              
              // Return the color for the category this indicator belongs to
              return CMPortal.benchmarkRadar.getCategoryInfo(indicatorLabel).color;
            }
          },
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
              
              // Get category info for the indicator
              const categoryInfo = CMPortal.benchmarkRadar.getCategoryInfo(indicator.label);
              
              // Include category in tooltip
              return `${protocolName}: ${kind}: ${qv} of ${indicator.rings} quantiles (${categoryInfo.icon} ${categoryInfo.name})`;
            }
          }
        }
      },
      elements: { 
        line: { 
          tension: 0.2,
          borderWidth: 3 // Thicker lines for better visibility
        }, 
        point: {
          radius: 5,      // Slightly larger default points
          hoverRadius: 8, // Larger radius on hover
          hitRadius: 10   // Larger hit radius for easier selection
        }
      },
      responsive: true, 
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,     // Add padding to ensure the chart stays within bounds
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      animation: {
        duration: 1000,
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
  
  // Add a resize handler to ensure the chart fills the space when window resizes
  window.addEventListener('resize', function() {
    if (CMPortal.benchmarkRadar.chart) {
      CMPortal.benchmarkRadar.chart.resize();
    }
  });

  // Force resize after chart is created
  setTimeout(function() {
    if (CMPortal.benchmarkRadar.chart) {
      CMPortal.benchmarkRadar.chart.resize();
    }
  }, 500);
  
  // Add the download buttons
  setTimeout(function() {
    CMPortal.benchmarkRadar.addDownloadButtons();
  }, 600);
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

// Update the chart with new data - with smooth transitions
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
      // Update reference label with smooth fade transition
      refLabel.style.opacity = '0';
      setTimeout(() => {
        refLabel.textContent = benchmarkData[referenceIndex][0];
        refLabel.style.opacity = '1';
      }, 300);
    }
  }
  
  // Prepare updated chart data
  const chartData = CMPortal.benchmarkRadar.prepareChartData();
  
  // Update only the reference dataset values with animation
  if (chartData && CMPortal.benchmarkRadar.chart) {
    // Only update the reference dataset (index 1) properties
    const dataset = CMPortal.benchmarkRadar.chart.data.datasets[1];
    
    // First update dataset label
    dataset.label = chartData.datasets[1].label;
    
    // Then animate the data points positions
    dataset.data = chartData.datasets[1].data;
    
    // Update the styling with a slight delay for staggered animation
    setTimeout(() => {
      dataset.pointBackgroundColor = chartData.datasets[1].pointBackgroundColor;
      dataset.pointBorderColor = chartData.datasets[1].pointBorderColor;
      dataset.pointRadius = chartData.datasets[1].pointRadius;
      
      // Force chart update with specific animation options
      CMPortal.benchmarkRadar.chart.update({
        duration: 800,
        easing: 'easeInOutQuart',
      });
    }, 100);
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

// Add download buttons (PNG and Editable SVG)
CMPortal.benchmarkRadar.addDownloadButtons = function() {
  // Add html2canvas library for better quality capture
  if (!window.html2canvas) {
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    html2canvasScript.onload = addButtons;
    document.head.appendChild(html2canvasScript);
  } else {
    addButtons();
  }
  
  function addButtons() {
    // Check if buttons already exist
    if (document.getElementById('download-radar-png')) return;
    
    // Get the radar chart container
    const chartContainer = document.querySelector('.protocol-selector');
    if (!chartContainer) return;
    
    // Create download buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'download-buttons';
    buttonContainer.style.marginLeft = 'auto';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    // Create the PNG download button
    const pngBtn = document.createElement('button');
    pngBtn.id = 'download-radar-png';
    pngBtn.className = 'btn download-btn';
    pngBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Install PNG';
    
    // Create the SVG download button for Illustrator
    const svgBtn = document.createElement('button');
    svgBtn.id = 'download-radar-svg';
    svgBtn.className = 'btn download-btn';
    svgBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Install SVG';
    
    // Add the buttons to the container
    buttonContainer.appendChild(pngBtn);
    buttonContainer.appendChild(svgBtn);
    
    // Add the button container to the protocol selector
    chartContainer.appendChild(buttonContainer);
    
    // Add styles for the download buttons
    const style = document.createElement('style');
    style.textContent = `
      .download-btn {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.3s;
      }
      .download-btn:hover {
        background-color: #2980b9;
      }
      .download-btn svg {
        width: 16px;
        height: 16px;
      }
      .protocol-selector {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    `;
    document.head.appendChild(style);
    
    // Add click event handlers
    pngBtn.addEventListener('click', function() {
      CMPortal.benchmarkRadar.downloadPNG();
    });
    
    svgBtn.addEventListener('click', function() {
      CMPortal.benchmarkRadar.downloadEditableSVG();
    });
  }
};

// Function to download the radar chart as PNG with legends
CMPortal.benchmarkRadar.downloadPNG = function() {
  // Show loading indicator
  const pngBtn = document.getElementById('download-radar-png');
  if (!pngBtn) return;
  
  const originalText = pngBtn.innerHTML;
  pngBtn.innerHTML = 'Generating PNG...';
  pngBtn.disabled = true;
  
  try {
    // Get the entire radar container including legend
    const radarContainer = document.querySelector('.radar-content');
    if (!radarContainer) throw new Error('Radar container not found');
    
    // Get protocol names for the filename
    const yourProtocolLabel = document.getElementById('userProtocolLabel').textContent;
    const refLabel = document.getElementById('refLabel').textContent;
    
    // Create clean names for the filename
    const cleanYourProtocol = yourProtocolLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const cleanRefProtocol = refLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileName = `CMPortal-Maturity-${cleanYourProtocol}-vs-${cleanRefProtocol}.png`;
    
    // Use html2canvas to capture the entire container
    html2canvas(radarContainer, {
      scale: 2, // Higher scale for better quality
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    }).then(function(canvas) {
      // Convert canvas to PNG data URL
      const dataURL = canvas.toDataURL('image/png');
      
      // Create a download link
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset button
      pngBtn.innerHTML = originalText;
      pngBtn.disabled = false;
    }).catch(function(error) {
      console.error('Error generating PNG:', error);
      alert('Could not generate PNG image. Please try again.');
      
      // Reset button
      pngBtn.innerHTML = originalText;
      pngBtn.disabled = false;
    });
  } catch (error) {
    console.error('Error generating PNG:', error);
    alert('Could not generate PNG image. Please try again.');
    
    // Reset button
    pngBtn.innerHTML = originalText;
    pngBtn.disabled = false;
  }
};

// Function to create an editable SVG for Illustrator
// Fix the SVG download function
CMPortal.benchmarkRadar.downloadEditableSVG = function() {
  // Show loading indicator
  const svgBtn = document.getElementById('download-radar-svg');
  if (!svgBtn) return;
  
  const originalText = svgBtn.innerHTML;
  svgBtn.innerHTML = 'Generating SVG...';
  svgBtn.disabled = true;
  
  try {
    // Get the chart data and configuration
    const chart = CMPortal.benchmarkRadar.chart;
    if (!chart) {
      throw new Error('Chart instance not found');
    }
    
    // Get canvas element and create a new SVG element
    const canvas = chart.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Get protocol names for the filename
    const yourProtocolLabel = document.getElementById('userProtocolLabel').textContent;
    const refLabel = document.getElementById('refLabel').textContent;
    
    // Create clean names for the filename
    const cleanYourProtocol = yourProtocolLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const cleanRefProtocol = refLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileName = `CMPortal-Maturity-${cleanYourProtocol}-vs-${cleanRefProtocol}.svg`;
    
    // Create a simplified SVG with just the chart data
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("xmlns", svgNS);
    
    // Add white background
    const background = document.createElementNS(svgNS, "rect");
    background.setAttribute("width", width);
    background.setAttribute("height", height);
    background.setAttribute("fill", "#ffffff");
    svg.appendChild(background);

    // Add title element
    const title = document.createElementNS(svgNS, "title");
    title.textContent = `Radar chart comparing ${yourProtocolLabel} and ${refLabel}`;
    svg.appendChild(title);
    
    // Calculate chart center and radius
    const chartArea = chart.chartArea;
    const center = {
      x: (chartArea.left + chartArea.right) / 2,
      y: (chartArea.top + chartArea.bottom) / 2
    };
    const radius = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) / 2;
    
    // Get datasets from the chart
    const datasets = chart.data.datasets;
    const labels = chart.data.labels;
    
    // Create a group for grid lines
    const gridGroup = document.createElementNS(svgNS, "g");
    gridGroup.setAttribute("id", "grid");
    
    // Draw concentric circles for grid
    for (let r = 0.2; r <= 1; r += 0.2) {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", center.x);
      circle.setAttribute("cy", center.y);
      circle.setAttribute("r", radius * r);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "#e0e0e0");
      circle.setAttribute("stroke-width", "1");
      gridGroup.appendChild(circle);
    }
    
    // Draw spokes for grid
    const numPoints = labels.length;
    const angleStep = (Math.PI * 2) / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from the top
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", center.x);
      line.setAttribute("y1", center.y);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "#e0e0e0");
      line.setAttribute("stroke-width", "1");
      gridGroup.appendChild(line);
      
      // Add label
      const labelDistance = radius * 1.1;
      const labelX = center.x + labelDistance * Math.cos(angle);
      const labelY = center.y + labelDistance * Math.sin(angle);
      
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", labelX);
      text.setAttribute("y", labelY);
      
      // Set anchor based on position
      if (angle === 0) text.setAttribute("text-anchor", "start");
      else if (Math.abs(angle - Math.PI) < 0.1) text.setAttribute("text-anchor", "end");
      else if (angle > 0 && angle < Math.PI) text.setAttribute("text-anchor", "start");
      else text.setAttribute("text-anchor", "end");
      
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("font-size", "12px");
      text.textContent = labels[i];
      gridGroup.appendChild(text);
    }
    
    svg.appendChild(gridGroup);
    
    // Add datasets
    for (let d = 0; d < datasets.length; d++) {
      const dataset = datasets[d];
      const dataGroup = document.createElementNS(svgNS, "g");
      dataGroup.setAttribute("id", `dataset-${d}`);
      
      // Create polygon for dataset area
      const points = [];
      for (let i = 0; i < numPoints; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const value = dataset.data[i];
        const pointRadius = value * radius;
        const x = center.x + pointRadius * Math.cos(angle);
        const y = center.y + pointRadius * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      
      const polygon = document.createElementNS(svgNS, "polygon");
      polygon.setAttribute("points", points.join(" "));
      polygon.setAttribute("fill", dataset.backgroundColor);
      polygon.setAttribute("stroke", dataset.borderColor);
      polygon.setAttribute("stroke-width", dataset.borderWidth);
      dataGroup.appendChild(polygon);
      
      // Add points
      for (let i = 0; i < numPoints; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const value = dataset.data[i];
        const pointRadius = value * radius;
        const x = center.x + pointRadius * Math.cos(angle);
        const y = center.y + pointRadius * Math.sin(angle);
        
        // Get point styling
        const bgColor = Array.isArray(dataset.pointBackgroundColor) ? dataset.pointBackgroundColor[i] : dataset.pointBackgroundColor;
        const borderColor = Array.isArray(dataset.pointBorderColor) ? dataset.pointBorderColor[i] : dataset.pointBorderColor;
        const pointSize = Array.isArray(dataset.pointRadius) ? dataset.pointRadius[i] : dataset.pointRadius;
        
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", pointSize);
        circle.setAttribute("fill", bgColor);
        circle.setAttribute("stroke", borderColor);
        circle.setAttribute("stroke-width", "1");
        dataGroup.appendChild(circle);
      }
      
      svg.appendChild(dataGroup);
    }
    
    // Add legend
    const legendGroup = document.createElementNS(svgNS, "g");
    legendGroup.setAttribute("transform", `translate(20, 20)`);
    
    // Create legend items
    const legendItems = [
      { color: datasets[0].borderColor, text: yourProtocolLabel },
      { color: datasets[1].borderColor, text: refLabel }
    ];
    
    // Add legend title
    const legendTitle = document.createElementNS(svgNS, "text");
    legendTitle.setAttribute("x", "0");
    legendTitle.setAttribute("y", "0");
    legendTitle.setAttribute("font-family", "Arial, sans-serif");
    legendTitle.setAttribute("font-size", "14px");
    legendTitle.setAttribute("font-weight", "bold");
    legendTitle.textContent = "Legend:";
    legendGroup.appendChild(legendTitle);
    
    // Add legend items
    legendItems.forEach((item, index) => {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(0, ${index * 25 + 20})`);
      
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("width", "20");
      rect.setAttribute("height", "20");
      rect.setAttribute("fill", item.color);
      g.appendChild(rect);
      
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", "30");
      text.setAttribute("y", "15");
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("font-size", "12px");
      text.textContent = item.text;
      g.appendChild(text);
      
      legendGroup.appendChild(g);
    });
    
    svg.appendChild(legendGroup);
    
    // Convert SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    
    // Create download link
    const blob = new Blob([svgString], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    // Reset button
    svgBtn.innerHTML = originalText;
    svgBtn.disabled = false;
    
  } catch (error) {
    console.error('Error generating SVG:', error);
    alert('There was an error generating the SVG file. Please try again.');
    
    // Reset button
    svgBtn.innerHTML = originalText;
    svgBtn.disabled = false;
  }
};

// Add download buttons (PNG and Editable SVG)
CMPortal.benchmarkRadar.addDownloadButtons = function() {
  // Add html2canvas library for better quality capture
  if (!window.html2canvas) {
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    html2canvasScript.onload = addButtons;
    document.head.appendChild(html2canvasScript);
  } else {
    addButtons();
  }
  
  function addButtons() {
    // Check if buttons already exist
    if (document.getElementById('download-radar-png')) return;
    
    // Get the protocol selector for button placement
    const protocolSelector = document.querySelector('.protocol-selector');
    if (!protocolSelector) return;
    
    // Get or create the button container
    let buttonContainer = protocolSelector.querySelector('.button-container');
    if (!buttonContainer) {
      buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';
      protocolSelector.appendChild(buttonContainer);
    }

    // Make sure regenerateBtn is in the button container
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn && regenerateBtn.parentNode !== buttonContainer) {
      regenerateBtn.parentNode.removeChild(regenerateBtn);
      buttonContainer.appendChild(regenerateBtn);
    }
    
    // Create download buttons
    const pngBtn = document.createElement('button');
    pngBtn.id = 'download-radar-png';
    pngBtn.className = 'btn download-btn';
    pngBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Install PNG';
    
    const svgBtn = document.createElement('button');
    svgBtn.id = 'download-radar-svg';
    svgBtn.className = 'btn download-btn';
    svgBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Install SVG';
    
    // Add the buttons to the container
    buttonContainer.appendChild(pngBtn);
    buttonContainer.appendChild(svgBtn);
    
    // Add styles for the buttons
    const style = document.createElement('style');
    style.textContent = `
      .download-btn {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.3s;
        margin-left: 10px;
      }
      .download-btn:hover {
        background-color: #2980b9;
      }
      .download-btn svg {
        width: 16px;
        height: 16px;
      }
      .protocol-selector {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .button-container {
        display: flex;
        align-items: center;
      }
      #regenerateBtn {
        margin-right: 5px;
      }
    `;
    document.head.appendChild(style);
    
    // Add click event handlers
    pngBtn.addEventListener('click', function() {
      CMPortal.benchmarkRadar.downloadPNG();
    });
    
    svgBtn.addEventListener('click', function() {
      CMPortal.benchmarkRadar.downloadEditableSVG();
    });
  }
};