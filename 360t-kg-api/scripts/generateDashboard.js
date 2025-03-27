// Script to generate HTML dashboard visualizations for knowledge graph analytics
const fs = require('fs');
const path = require('path');

// Import analytics function to run if needed
const { runAnalytics } = require('./analyzeGraph');

// Paths
const reportsDir = path.join(__dirname, '../reports');
const dashboardDir = path.join(__dirname, '../public/dashboard');
const templatesDir = path.join(__dirname, '../templates');

// Ensure directories exist
if (!fs.existsSync(dashboardDir)) {
  fs.mkdirSync(dashboardDir, { recursive: true });
}
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Create base dashboard template
function createBaseTemplate() {
  const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>360T Knowledge Graph Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    body { padding-top: 60px; padding-bottom: 40px; }
    .card { margin-bottom: 20px; }
    .dashboard-title { margin-bottom: 30px; }
    .chart-container { position: relative; height: 300px; margin-bottom: 30px; }
    .network-chart { height: 500px; border: 1px solid #ddd; border-radius: 4px; }
    .data-table { font-size: 0.9rem; }
    .data-table th { position: sticky; top: 0; background-color: #f8f9fa; }
    .table-container { max-height: 400px; overflow-y: auto; }
    .nav-pills .nav-link.active { background-color: #007bff; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-md navbar-dark bg-dark fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="#">360T Knowledge Graph Dashboard</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarCollapse">
        <ul class="navbar-nav me-auto mb-2 mb-md-0">
          <li class="nav-item">
            <a class="nav-link active" aria-current="page" href="index.html">Dashboard</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="modules.html">Modules</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="products.html">Products</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="test-coverage.html">Test Coverage</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="navigation.html">UI Navigation</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="relationships.html">Relationships</a>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="container">
    <!-- CONTENT_PLACEHOLDER -->
  </main>

  <footer class="footer mt-auto py-3 bg-light">
    <div class="container text-center">
      <span class="text-muted">360T Knowledge Graph Dashboard | Generated: {{GENERATION_DATE}}</span>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
  <!-- SCRIPTS_PLACEHOLDER -->
</body>
</html>`;

  fs.writeFileSync(path.join(templatesDir, 'base-template.html'), template);
  console.log('Base template created');
}

// Generate main dashboard page
async function generateMainDashboard() {
  // Check if reports exist, if not, run analytics
  if (!fs.existsSync(path.join(reportsDir, 'consolidated-analytics.json'))) {
    console.log('Analytics data not found. Running analytics first...');
    await runAnalytics();
  }

  // Read analytics data
  const analytics = JSON.parse(fs.readFileSync(path.join(reportsDir, 'consolidated-analytics.json'), 'utf8'));
  
  // Load template
  let template = fs.readFileSync(path.join(templatesDir, 'base-template.html'), 'utf8');

  // Create dashboard content
  const content = `
    <h1 class="dashboard-title">360T Knowledge Graph Overview</h1>
    
    <div class="row">
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Modules</h5>
            <h2 class="card-text">${analytics.moduleStatistics.length}</h2>
            <p class="card-text text-muted">Total modules in the knowledge graph</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Products</h5>
            <h2 class="card-text">${analytics.productUsage.length}</h2>
            <p class="card-text text-muted">Total products defined</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Test Cases</h5>
            <h2 class="card-text">${analytics.testDistribution.reduce((sum, item) => sum + item.count, 0)}</h2>
            <p class="card-text text-muted">Across all components</p>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Module Composition</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="moduleCompositionChart"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Test Coverage</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="testCoverageChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Test Distribution by Type</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="testDistributionChart"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Configuration Impact</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="configImpactChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">Relationship Types</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="relationshipTypesChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create chart initialization scripts
  const scripts = `
  <script>
    // Module Composition Chart
    const moduleData = ${JSON.stringify(analytics.moduleStatistics)};
    const moduleCtx = document.getElementById('moduleCompositionChart').getContext('2d');
    new Chart(moduleCtx, {
      type: 'bar',
      data: {
        labels: moduleData.map(m => m.module),
        datasets: [
          {
            label: 'Workflows',
            data: moduleData.map(m => m.workflowCount),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'UI Areas',
            data: moduleData.map(m => m.uiAreaCount),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          },
          {
            label: 'Dependencies',
            data: moduleData.map(m => m.dependencyCount),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: false,
            title: {
              display: true,
              text: 'Module'
            }
          },
          y: {
            stacked: false,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          }
        }
      }
    });

    // Test Coverage Chart
    const coverageData = ${JSON.stringify(analytics.testCoverage)};
    const coverageCtx = document.getElementById('testCoverageChart').getContext('2d');
    new Chart(coverageCtx, {
      type: 'bar',
      data: {
        labels: coverageData.map(m => m.module),
        datasets: [
          {
            label: 'Coverage Ratio',
            data: coverageData.map(m => m.coverageRatio * 100),
            backgroundColor: coverageData.map(m => {
              const ratio = m.coverageRatio;
              if (ratio >= 0.8) return 'rgba(40, 167, 69, 0.7)';
              if (ratio >= 0.5) return 'rgba(255, 193, 7, 0.7)';
              return 'rgba(220, 53, 69, 0.7)';
            }),
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return \`Test Coverage: \${context.parsed.y.toFixed(1)}%\`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Coverage (%)'
            }
          }
        }
      }
    });

    // Test Distribution Chart
    const testDistData = ${JSON.stringify(analytics.testDistribution)};
    const testTypes = [...new Set(testDistData.map(t => t.testType))];
    const testPriorities = [...new Set(testDistData.map(t => t.priority))];
    const testDistCtx = document.getElementById('testDistributionChart').getContext('2d');
    
    const testDatasets = testPriorities.map((priority, index) => {
      const colors = [
        'rgba(255, 99, 132, 0.7)',   // High - Red
        'rgba(255, 159, 64, 0.7)',   // Medium - Orange
        'rgba(75, 192, 192, 0.7)'    // Low - Green
      ];
      return {
        label: priority,
        data: testTypes.map(type => {
          const match = testDistData.find(t => t.testType === type && t.priority === priority);
          return match ? match.count : 0;
        }),
        backgroundColor: colors[index % colors.length],
        borderWidth: 1
      };
    });
    
    new Chart(testDistCtx, {
      type: 'bar',
      data: {
        labels: testTypes,
        datasets: testDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Test Type'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          }
        }
      }
    });

    // Configuration Impact Chart
    const configData = ${JSON.stringify(analytics.configurationImpact)};
    const configCtx = document.getElementById('configImpactChart').getContext('2d');
    new Chart(configCtx, {
      type: 'horizontalBar',
      data: {
        labels: configData.slice(0, 5).map(c => c.configItem),
        datasets: [
          {
            label: 'Impact Score',
            data: configData.slice(0, 5).map(c => c.impactScore),
            backgroundColor: 'rgba(153, 102, 255, 0.7)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Impact Score'
            }
          }
        }
      }
    });

    // Relationship Types Chart
    const relationshipData = ${JSON.stringify(analytics.relationshipSummary)};
    const relationshipTypes = [...new Set(relationshipData.map(r => r.relationship))];
    const sourceTypes = [...new Set(relationshipData.map(r => r.sourceType))];
    const relationshipCtx = document.getElementById('relationshipTypesChart').getContext('2d');
    
    const relationshipCounts = relationshipTypes.map(type => {
      return relationshipData
        .filter(r => r.relationship === type)
        .reduce((sum, r) => sum + r.count, 0);
    });
    
    new Chart(relationshipCtx, {
      type: 'pie',
      data: {
        labels: relationshipTypes,
        datasets: [
          {
            data: relationshipCounts,
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
              'rgba(255, 159, 64, 0.7)',
              'rgba(199, 199, 199, 0.7)'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return \`\${context.label}: \${value} (\${percentage}%)\`;
              }
            }
          }
        }
      }
    });
  </script>
  `;

  // Replace placeholders
  template = template.replace('<!-- CONTENT_PLACEHOLDER -->', content);
  template = template.replace('<!-- SCRIPTS_PLACEHOLDER -->', scripts);
  template = template.replace('{{GENERATION_DATE}}', new Date().toLocaleString());

  // Write to file
  fs.writeFileSync(path.join(dashboardDir, 'index.html'), template);
  console.log('Main dashboard generated');
}

// Generate modules dashboard page
async function generateModulesDashboard() {
  // Read analytics data
  const analytics = JSON.parse(fs.readFileSync(path.join(reportsDir, 'consolidated-analytics.json'), 'utf8'));
  
  // Load template
  let template = fs.readFileSync(path.join(templatesDir, 'base-template.html'), 'utf8');

  // Create dashboard content
  const content = `
    <h1 class="dashboard-title">Module Analysis</h1>
    
    <div class="row">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">Module Dependencies Network</div>
          <div class="card-body">
            <div id="moduleNetwork" class="network-chart"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">Module Details</div>
          <div class="card-body">
            <div class="table-container">
              <table class="table table-striped table-hover data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Version</th>
                    <th>Workflows</th>
                    <th>UI Areas</th>
                    <th>Dependencies</th>
                    <th>Test Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  ${analytics.moduleStatistics.map(module => {
                    const coverage = analytics.testCoverage.find(m => m.module === module.module);
                    const coveragePercent = coverage ? Math.round(coverage.coverageRatio * 100) : 0;
                    let coverageClass = 'bg-danger text-white';
                    if (coveragePercent >= 80) {
                      coverageClass = 'bg-success text-white';
                    } else if (coveragePercent >= 50) {
                      coverageClass = 'bg-warning';
                    }
                    
                    return `
                      <tr>
                        <td>${module.module}</td>
                        <td>${module.version}</td>
                        <td>${module.workflowCount}</td>
                        <td>${module.uiAreaCount}</td>
                        <td>${module.dependencyCount}</td>
                        <td><span class="badge ${coverageClass}">${coveragePercent}%</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create chart initialization scripts
  const scripts = `
  <script>
    // Module Dependencies Network
    const moduleData = ${JSON.stringify(analytics.moduleDependencies)};
    
    // Create a network visualization
    const width = document.getElementById('moduleNetwork').clientWidth;
    const height = 500;
    
    // Create nodes array
    const nodes = moduleData.map(m => ({ id: m.module, label: m.module }));
    
    // Create links array
    const links = [];
    moduleData.forEach(m => {
      m.dependencies.forEach(dep => {
        links.push({ source: m.module, target: dep });
      });
    });
    
    // Create SVG
    const svg = d3.select('#moduleNetwork')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // Create a force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);
    
    // Create nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#69b3a2')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add labels
    const text = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text(d => d.label)
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4);
    
    // Update positions on each simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      text
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
  `;

  // Replace placeholders
  template = template.replace('<!-- CONTENT_PLACEHOLDER -->', content);
  template = template.replace('<!-- SCRIPTS_PLACEHOLDER -->', scripts);
  template = template.replace('{{GENERATION_DATE}}', new Date().toLocaleString());

  // Write to file
  fs.writeFileSync(path.join(dashboardDir, 'modules.html'), template);
  console.log('Modules dashboard generated');
}

// Main function to generate all dashboard pages
async function generateDashboard() {
  try {
    console.log('Starting dashboard generation...');
    
    // Create base template
    createBaseTemplate();
    
    // Generate individual dashboard pages
    await generateMainDashboard();
    await generateModulesDashboard();
    
    // Additional dashboards can be added here
    
    console.log('Dashboard generation completed successfully');
    console.log(`Dashboard is available at: ${dashboardDir}/index.html`);
    return 'SUCCESS: Dashboard generated';
  } catch (error) {
    console.error('Error generating dashboard:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  generateDashboard()
    .catch(error => {
      console.error('Failed to generate dashboard:', error);
      process.exit(1);
    });
}

module.exports = { generateDashboard }; 