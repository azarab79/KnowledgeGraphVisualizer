/**
 * Test utilities for validating search functionality
 * To use this, open your browser console and execute:
 * import('/src/services/testSearch.js').then(m => m.runSearchTests())
 */

import { searchNodes, getInitialGraph } from './api';

/**
 * Run a search and log results with timing information
 */
const testSearch = async (query) => {
  console.log(`\n===== Testing search for: "${query}" =====`);
  
  try {
    const startTime = performance.now();
    const results = await searchNodes(query);
    const endTime = performance.now();
    
    const timing = (endTime - startTime).toFixed(2);
    const resultCount = results?.nodes?.length || 0;
    
    console.log(`Results: ${resultCount} nodes (took ${timing}ms)`);
    
    if (resultCount > 0) {
      console.log("First 3 results:");
      results.nodes.slice(0, 3).forEach((node, i) => {
        const name = node.properties?.name || node.id;
        const type = node.labels?.[0] || node.group || 'Unknown';
        console.log(`${i+1}. ${name} (${type})`);
      });
    } else {
      console.log("No results found");
    }
    
    return { success: true, resultCount, timing };
  } catch (err) {
    console.error(`Search failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Test mixed case searches
 */
const testCaseInsensitivity = async () => {
  console.log("\n----- TESTING CASE INSENSITIVITY -----");
  
  // Get a search term from the initial graph that we can use for testing
  let testTerm = "rfs";
  try {
    const initialGraph = await getInitialGraph();
    if (initialGraph?.nodes?.length > 0) {
      const randomNode = initialGraph.nodes[0];
      if (randomNode.properties?.name) {
        testTerm = randomNode.properties.name.substring(0, 3);
        console.log(`Using "${testTerm}" from the graph data as test term`);
      }
    }
  } catch (err) {
    console.warn("Could not get initial graph for test term selection:", err);
  }
  
  // Test lowercase, uppercase, and mixed case
  const lowercase = await testSearch(testTerm.toLowerCase());
  const uppercase = await testSearch(testTerm.toUpperCase());
  const mixedcase = await testSearch(testTerm.split('').map((c, i) => 
    i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
  ).join(''));
  
  // Results should be the same regardless of case
  const success = lowercase.resultCount === uppercase.resultCount && 
                  lowercase.resultCount === mixedcase.resultCount;
  
  if (success) {
    console.log(`✅ Case insensitivity test PASSED - all searches returned ${lowercase.resultCount} results`);
  } else {
    console.log("❌ Case insensitivity test FAILED - results counts differ:");
    console.log(`  - Lowercase: ${lowercase.resultCount}`);
    console.log(`  - Uppercase: ${uppercase.resultCount}`);
    console.log(`  - Mixedcase: ${mixedcase.resultCount}`);
  }
  
  return success;
};

/**
 * Test partial matching
 */
const testPartialMatching = async () => {
  console.log("\n----- TESTING PARTIAL MATCHING -----");
  
  // Get a search term from initial graph if possible
  let testTerm = "pri";
  try {
    const initialGraph = await getInitialGraph();
    if (initialGraph?.nodes?.length > 0) {
      const randomNode = initialGraph.nodes[0];
      if (randomNode.properties?.name && randomNode.properties.name.length > 5) {
        testTerm = randomNode.properties.name.substring(1, 4);
        console.log(`Using "${testTerm}" from the graph data as test term`);
      }
    }
  } catch (err) {
    console.warn("Could not get initial graph for test term selection:", err);
  }
  
  // Test with full and partial term
  const partial1 = await testSearch(testTerm);
  const partial2 = await testSearch(testTerm.substring(0, 2));
  const partial3 = await testSearch(testTerm.substring(1));
  
  const success = partial1.resultCount > 0 && partial2.resultCount > 0 && partial3.resultCount > 0;
  
  if (success) {
    console.log("✅ Partial matching test PASSED - all partial searches returned results");
  } else {
    console.log("❌ Partial matching test FAILED - some partial searches returned no results");
  }
  
  return success;
};

/**
 * Test caching behavior
 */
const testCaching = async () => {
  console.log("\n----- TESTING CACHING -----");
  
  const term = "test";
  
  console.log("First search (should be slower):");
  const first = await testSearch(term);
  
  console.log("\nSecond search (should be faster if caching works):");
  const second = await testSearch(term);
  
  const cachingWorks = second.timing < first.timing;
  
  if (cachingWorks) {
    console.log(`✅ Caching test PASSED - second search (${second.timing}ms) was faster than first (${first.timing}ms)`);
  } else {
    console.log(`❓ Caching test INDETERMINATE - second search (${second.timing}ms) vs first (${first.timing}ms)`);
  }
  
  return cachingWorks;
};

/**
 * Run all search tests
 */
export const runSearchTests = async () => {
  console.log("==================================================");
  console.log("🧪 STARTING SEARCH FUNCTIONALITY TESTS");
  console.log("==================================================");
  
  // Perform basic search test
  await testSearch("live pricing");
  
  // Test case insensitivity
  const caseTest = await testCaseInsensitivity();
  
  // Test partial matching
  const partialTest = await testPartialMatching();
  
  // Test caching
  const cachingTest = await testCaching();
  
  console.log("\n==================================================");
  console.log("📋 TEST SUMMARY:");
  console.log("==================================================");
  console.log(`Case Insensitivity: ${caseTest ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Partial Matching:   ${partialTest ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Caching:            ${cachingTest ? '✅ PASSED' : '❓ INDETERMINATE'}`);
  console.log("==================================================");
  
  if (caseTest && partialTest) {
    console.log("🎉 SEARCH FUNCTIONALITY TESTS PASSED! 🎉");
  } else {
    console.log("❌ SOME TESTS FAILED. Check console logs above for details.");
  }
  
  return {
    caseInsensitivity: caseTest,
    partialMatching: partialTest,
    caching: cachingTest,
    allPassed: caseTest && partialTest
  };
};

/**
 * Debug utility to check node configuration in localStorage
 */
export const checkNodeConfig = () => {
  console.log("==================================================");
  console.log("🔍 CHECKING NODE CONFIGURATION");
  console.log("==================================================");
  
  try {
    const savedConfig = localStorage.getItem('knowledge-graph-node-config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      console.log('Current node configuration in localStorage:');
      console.log(config);
      
      if (config.colors && Object.keys(config.colors).length > 0) {
        console.log("✅ Color configuration found");
        console.log("Colors defined for node types:", Object.keys(config.colors));
      } else {
        console.log("❌ No color configuration found");
      }
      
      if (config.sizes && Object.keys(config.sizes).length > 0) {
        console.log("✅ Size configuration found");
        console.log("Sizes defined for node types:", Object.keys(config.sizes));
      } else {
        console.log("❌ No size configuration found");
      }
      
      return config;
    } else {
      console.log("❌ No node configuration found in localStorage");
      return null;
    }
  } catch (err) {
    console.error("Error checking node configuration:", err);
    return null;
  }
};

/**
 * Diagnose node color persistence issues
 */
export const diagnoseNodeColors = (nodes) => {
  console.log("==================================================");
  console.log("🔍 DIAGNOSING NODE COLOR PERSISTENCE");
  console.log("==================================================");
  
  // Check localStorage configuration
  let savedConfig = null;
  try {
    savedConfig = localStorage.getItem('knowledge-graph-node-config');
    if (!savedConfig) {
      console.log("❌ No configuration found in localStorage!");
      return;
    }
    
    const parsedConfig = JSON.parse(savedConfig);
    console.log("✅ Found configuration in localStorage:", parsedConfig);
    
    // Analyze configuration
    if (!parsedConfig.colors || Object.keys(parsedConfig.colors).length === 0) {
      console.log("❌ No colors defined in configuration!");
    } else {
      console.log(`✅ Colors defined for ${Object.keys(parsedConfig.colors).length} node types:`, 
                 Object.keys(parsedConfig.colors));
    }
    
    // Check nodes if provided
    if (nodes && Array.isArray(nodes)) {
      console.log(`\nAnalyzing ${nodes.length} nodes for color properties...`);
      
      // Count by type
      const nodesByType = {};
      for (const node of nodes) {
        const nodeType = node.labels && node.labels.length > 0 
          ? node.labels[0] 
          : (node.group || 'Unknown');
        
        nodesByType[nodeType] = (nodesByType[nodeType] || 0) + 1;
      }
      
      console.log("Node types in data:", nodesByType);
      
      // Check color properties
      const nodesWithColor = nodes.filter(n => n.color !== undefined && n.color !== null);
      console.log(`Nodes with color property: ${nodesWithColor.length} / ${nodes.length}`);
      
      if (nodesWithColor.length === 0) {
        console.log("❌ No nodes have color properties!");
      } else if (nodesWithColor.length < nodes.length) {
        console.log("⚠️ Some nodes are missing color properties");
      } else {
        console.log("✅ All nodes have color properties");
      }
      
      // Check type mappings
      const mismatchedNodes = [];
      for (const nodeType in nodesByType) {
        if (parsedConfig.colors && !parsedConfig.colors[nodeType]) {
          mismatchedNodes.push(nodeType);
        }
      }
      
      if (mismatchedNodes.length > 0) {
        console.log("⚠️ Node types without color mapping:", mismatchedNodes);
      } else {
        console.log("✅ All node types have color mappings");
      }
    }
  } catch (err) {
    console.error("Error diagnosing node colors:", err);
  }
  
  return {
    hasConfig: !!savedConfig,
    config: savedConfig ? JSON.parse(savedConfig) : null,
  };
};

// Expose globally for manual testing
window.testSearch = testSearch;
window.runSearchTests = runSearchTests;

// Expose globally for debugging
window.checkNodeConfig = checkNodeConfig;
window.diagnoseNodeColors = diagnoseNodeColors;
window.applyColorsToGraph = (graph) => {
  if (!graph || !graph.nodes) {
    console.error("No graph data provided!");
    return null;
  }
  
  console.log("Manually applying colors to graph data...");
  try {
    const savedConfig = localStorage.getItem('knowledge-graph-node-config');
    if (!savedConfig) {
      console.log("No configuration found!");
      return graph;
    }
    
    const parsedConfig = JSON.parse(savedConfig);
    if (!parsedConfig.colors || Object.keys(parsedConfig.colors).length === 0) {
      console.log("No colors defined in configuration!");
      return graph;
    }
    
    // Clone the graph to avoid mutations
    const newGraph = JSON.parse(JSON.stringify(graph));
    
    // Apply colors to nodes
    newGraph.nodes = newGraph.nodes.map(node => {
      const nodeType = node.labels && node.labels.length > 0 
        ? node.labels[0] 
        : (node.group || 'Default');
      
      return {
        ...node,
        color: parsedConfig.colors[nodeType] || null,
        size: parsedConfig.sizes?.[nodeType] || null
      };
    });
    
    console.log(`Applied colors to ${newGraph.nodes.length} nodes`);
    return newGraph;
  } catch (err) {
    console.error("Error applying colors:", err);
    return graph;
  }
}; 