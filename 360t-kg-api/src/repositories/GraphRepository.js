const neo4j = require('neo4j-driver');

/**
 * GraphRepository - Wraps Neo4j driver operations
 */
class GraphRepository {
  constructor(driver, database = 'neo4j') {
    this.driver = driver;
    this.database = database;
  }

  getSession() {
    return this.driver.session({ database: this.database });
  }

  async getInitialGraph(limit = 100) {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT $limit
      `, { limit });

      const nodes = new Map();
      const edges = [];

      result.records.forEach(record => {
        const n = record.get('n');
        const m = record.get('m');
        const r = record.get('r');

        // Add nodes
        [n, m].forEach(node => {
          if (!nodes.has(node.identity.toString())) {
            nodes.set(node.identity.toString(), {
              id: node.identity.toString(),
              label: node.properties.name || node.properties.test_case_id || 'Unnamed',
              group: node.labels[0],
              properties: node.properties
            });
          }
        });

        // Add edge
        edges.push({
          id: r.identity.toString(),
          from: r.start.toString(),
          to: r.end.toString(),
          label: r.type,
          properties: r.properties
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        edges
      };
    } finally {
      await session.close();
    }
  }

  async runLouvain(resolution = 1.0, subGraph = null) {
    const session = this.getSession();
    try {
      const graphName = 'explorerGraph';
      
      // Drop existing graph
      await session.run(`CALL gds.graph.drop($graphName, false)`, { graphName }).catch(() => {});

      // Project graph
      if (subGraph) {
        await session.run(`CALL gds.graph.project($graphName, $subGraph, '*')`, { graphName, subGraph });
      } else {
        await session.run(`CALL gds.graph.project($graphName, '*', '*')`, { graphName });
      }

      // Run Louvain
      const louvainResult = await session.run(
        `CALL gds.louvain.write($graphName, { writeProperty:'communityId' }) YIELD modularity, communityCount`,
        { graphName }
      );
      
      const summary = louvainResult.records[0];
      const modularity = summary.get('modularity');
      const communityCount = summary.get('communityCount').toNumber ? summary.get('communityCount').toNumber() : summary.get('communityCount');

      // Get community representatives
      const nodesRes = await session.run(
        `MATCH (n) WHERE n.communityId IS NOT NULL RETURN n.communityId AS cid, collect(n)[0] AS rep, size(collect(n)) AS size ORDER BY size DESC LIMIT 50`
      );

      const communities = nodesRes.records.map(r => {
        const repNode = r.get('rep');
        const size = r.get('size').toNumber ? r.get('size').toNumber() : r.get('size');
        return {
          communityId: r.get('cid').toNumber ? r.get('cid').toNumber() : r.get('cid'),
          size,
          label: repNode.properties.name || repNode.properties.test_case_id || 'Unnamed',
          nodeId: repNode.identity.toString()
        };
      });

      // Get nodes and edges for visualization
      const graphRes = await session.run(
        `MATCH (n)-[r]->(m) WHERE n.communityId IS NOT NULL AND m.communityId IS NOT NULL WITH n,r,m LIMIT 1000 RETURN n,r,m`
      );

      const nodesMap = new Map();
      const edges = [];
      graphRes.records.forEach(rec => {
        const n = rec.get('n');
        const m = rec.get('m');
        const r = rec.get('r');
        
        const addNode = (node) => {
          if (!nodesMap.has(node.identity.toString())) {
            nodesMap.set(node.identity.toString(), {
              id: node.identity.toString(),
              label: node.properties.name || node.properties.test_case_id || 'Unnamed',
              group: node.labels[0],
              communityId: node.properties.communityId
            });
          }
        };
        
        addNode(n); 
        addNode(m);
        edges.push({
          id: r.identity.toString(),
          from: r.start.toString(),
          to: r.end.toString(),
          label: r.type
        });
      });

      return { 
        modularity, 
        communityCount, 
        communities, 
        nodes: Array.from(nodesMap.values()), 
        edges 
      };
    } finally {
      await session.close();
    }
  }

  async predictLinks(topN = 20, threshold = 0.4) {
    // --- New: model freshness TTL (7 days) & helper ------------------------
    const MODEL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    /**
     * Check if a pipeline-trained model with the specified name is fresh enough
     * to be reused.
     *
     * @param {neo4j.Session} session – active Neo4j session
     * @param {string} modelName – model identifier
     * @returns {Promise<boolean>} – true when model exists & is < TTL
     */
    const isPipelineModelFresh = async (session, modelName) => {
      try {
        const res = await session.run(
          `CALL gds.beta.model.list($modelName) YIELD modelName, creationTimeEpochMillis RETURN creationTimeEpochMillis`,
          { modelName }
        );
        if (res.records.length === 0) return false;
        const creationEpochMs = res.records[0].get('creationTimeEpochMillis') || res.records[0].get('creationTime');
        const creationMs = typeof creationEpochMs === 'number' ? creationEpochMs : creationEpochMs.toNumber();
        return Date.now() - creationMs < MODEL_TTL_MS;
      } catch (err) {
        // Likely running on GDS <2.2 where gds.beta.model.list is absent
        return false;
      }
    };

    /**
     * Task 2: Add catalog cleanup guard before each request
     * Safely clean up stale catalog objects (pipeline/model/graph) to prevent "already exists" exceptions
     */
    const cleanupCatalogObjects = async (session, graphName, pipelineName, modelName) => {
      try {
        // Drop existing graph
        await session.run(`CALL gds.graph.drop($graphName, false)`, { graphName }).catch(() => {});
        
        // Drop existing pipeline (swallow "already exists" errors)
        await session.run(`CALL gds.beta.pipeline.drop($pipelineName, false)`, { pipelineName }).catch(() => {});
        
        // Drop existing model (swallow "already exists" errors)
        await session.run(`CALL gds.beta.model.drop($modelName, false)`, { modelName }).catch(() => {});
        
        console.log(`[Hidden Links] Catalog cleanup completed for graph: ${graphName}, pipeline: ${pipelineName}, model: ${modelName}`);
      } catch (err) {
        console.warn(`[Hidden Links] Catalog cleanup warning:`, err.message);
        // Don't throw - continue with execution even if cleanup partially fails
      }
    };

    /**
     * Task 3: Detect legacy procedure availability via dbms.procedures() and skip fallback if absent
     */
    const detectAvailableProcedures = async (session) => {
      try {
        const result = await session.run(
          `CALL dbms.procedures() YIELD name WHERE name STARTS WITH 'gds' AND name CONTAINS 'linkprediction' RETURN name`
        );
        
        const availableProcedures = result.records.map(record => record.get('name'));
        
        const hasModernPipeline = availableProcedures.some(name => 
          name.includes('beta.pipeline.linkPrediction')
        );
        
        const hasLegacyTrain = availableProcedures.some(name => 
          name === 'gds.linkprediction.train' || name === 'gds.alpha.linkprediction.train'
        );
        
        console.log(`[Hidden Links] Available procedures - Modern pipeline: ${hasModernPipeline}, Legacy train: ${hasLegacyTrain}`);
        
        return {
          hasModernPipeline,
          hasLegacyTrain,
          availableProcedures
        };
      } catch (err) {
        console.warn(`[Hidden Links] Failed to detect available procedures:`, err.message);
        return {
          hasModernPipeline: true, // Assume modern by default
          hasLegacyTrain: true,    // Assume legacy available by default
          availableProcedures: []
        };
      }
    };

    const session = this.getSession();

    // Respect environment variables for custom graph projection labels/types
    const NODE_PROJECTION = process.env.GDS_GRAPH_NODES || '*';
    const REL_PROJECTION = process.env.GDS_GRAPH_RELATIONSHIPS || '*';

    // Helper to detect GDS major version once per repository instance
    const getGdsMajorVersion = async () => {
      if (this._cachedGdsMajor !== undefined) return this._cachedGdsMajor;
      try {
        const res = await session.run(
          "CALL gds.debug.sysInfo() YIELD key, value WHERE key = 'gdsVersion' RETURN value LIMIT 1"
        );
        if (res.records.length === 0) return (this._cachedGdsMajor = -1);
        const versionString = res.records[0].get('value');
        const major = parseInt(versionString.split('.')[0], 10);
        this._cachedGdsMajor = major;
        return major;
      } catch (err) {
        console.warn('Could not detect GDS version:', err.message);
        this._cachedGdsMajor = -1;
        return -1;
      }
    };

    const gdsMajor = await getGdsMajorVersion();
    
    // Task 4: Parameterize per-request unique pipeline / model names to avoid collisions
    const uniqueId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    const graphName = `explorerGraph_${uniqueId}`;
    const pipelineName = `explorerLPPipe_${uniqueId}`;
    const modelName = `explorerLPModel_${uniqueId}`;
    
    // Detect available procedures before attempting to use them
    const procedureCapabilities = await detectAvailableProcedures(session);

    // Metrics histogram
    const { hiddenLinksHistogram } = require('../../utils/metrics');

    const timerEnd = hiddenLinksHistogram.startTimer();
    try {
      // Common helper to convert Neo4j integers safely
      const toJs = (val) => (typeof val === 'number' ? val : val.toNumber());

      // Task 2: Clean up catalog objects before proceeding
      await cleanupCatalogObjects(session, graphName, pipelineName, modelName);

      // ---------------------------------------------------------------------
      // Attempt modern GDS 2.x pipeline-based workflow
      // ---------------------------------------------------------------------
      if (procedureCapabilities.hasModernPipeline) {
        try {
          console.log('[Hidden Links] Attempting modern GDS pipeline workflow...');
          // 0. Check for fresh model first – if present we can skip retraining
          const reuseExistingModel = await isPipelineModelFresh(session, modelName);
          console.log(`[Hidden Links] Reusing existing model: ${reuseExistingModel}`);

          // --- FIX: Project all relationship types explicitly so GDS can see them ---
          // const relTypesRes = await session.run(`CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types`);
          // const relTypes = relTypesRes.records[0].get('types');

          // if (!relTypes || relTypes.length === 0) {
          //   throw new Error('No relationship types found in the database to project for link prediction.');
          // }

          const relationshipProjection = {
            MENTIONS: { orientation: 'NATURAL' },
            RELATES_TO: { orientation: 'NATURAL' },
            HAS_ALIAS: { orientation: 'NATURAL' }
            // Add any other expected relationship types here
          };
          
          console.log(`[Hidden Links] Projecting graph with relationships:`, Object.keys(relationshipProjection));
          await session.run(`CALL gds.graph.project($graphName, '*', $relationshipProjection)`, 
            { graphName, relationshipProjection }
          );

          // Use the first available relationship type as the positive class for training.
          const targetRel = 'MENTIONS'; // Hardcode for testing
          console.log(`[Hidden Links] Using '${targetRel}' as target relationship for training.`);

          if (!reuseExistingModel) {
            // 2. Build the link-prediction training pipeline (Task 1: Safe pipeline creation)
            await session.run(`CALL gds.beta.pipeline.linkPrediction.create($pl)`, { pl: pipelineName }).catch(err => {
              if (!String(err.message).includes('already exists')) {
                throw err; // rethrow unexpected errors
              }
            });

            // 2a. Add Node2Vec embeddings as node property step
            const uniqueSuffix = Date.now().toString();
            const embeddingProp = `embedding_${uniqueSuffix}`;
            await session.run(
              `CALL gds.beta.pipeline.linkPrediction.addNodeProperty($pl, 'node2vec', {
                mutateProperty: $embedProp,
                embeddingDimension: 64
              })`,
              { pl: pipelineName, embedProp: embeddingProp }
            );

            // 2b. Add link feature combining embeddings via Hadamard product
            await session.run(
              `CALL gds.beta.pipeline.linkPrediction.addFeature($pl, 'hadamard', {
                nodeProperties: [$embedProp]
              })`,
              { pl: pipelineName, embedProp: embeddingProp }
            );

            // 2c. Add a default logistic-regression model candidate
            await session.run(`CALL gds.beta.pipeline.linkPrediction.addLogisticRegression($pl)`, {
              pl: pipelineName
            });

            // 3. Train the pipeline (auto split defaults)
            await session.run(
              `CALL gds.beta.pipeline.linkPrediction.train($graphName, {
                pipeline: $pl,
                modelName: $model,
                targetRelationshipType: $targetRel
              }) YIELD modelInfo`,
              {
                graphName,
                pl: pipelineName,
                model: modelName,
                targetRel: targetRel,
              }
            );
          }

          // 4. Predict missing links using (fresh or cached) model
          const predRes = await session.run(
            `CALL gds.beta.pipeline.linkPrediction.predict.stream($graphName, {
              modelName: $model,
              topN: $topN,
              threshold: $threshold
            }) YIELD sourceNodeId, targetNodeId, probability
            RETURN sourceNodeId, targetNodeId, probability
            ORDER BY probability DESC`,
            {
              graphName,
              model: modelName,
              topN: neo4j.int(topN),
              threshold
            }
          );

          const predictions = predRes.records.map((r) => ({
            source: toJs(r.get('sourceNodeId')),
            target: toJs(r.get('targetNodeId')),
            probability: r.get('probability')
          }));

          console.log('[Hidden Links] Modern pipeline workflow completed successfully.');
          timerEnd();
          return { predictions };
        } catch (pipelineErr) {
          console.error('Modern pipeline API failed catastrophically:', pipelineErr);
          // Ensure we drop any in-memory graph created by the failed modern attempt
          await session.run(`CALL gds.graph.drop($graphName, false)`, { graphName }).catch(() => {});
          
          // Re-throw the original error to the client instead of masking it with the fallback.
          // This is critical for debugging the *actual* issue.
          throw pipelineErr;
        }
      }

      // -----------------------------------------------------------------
      // Fallback: legacy GDS 1.x workflow for older versions (only if available)
      // -----------------------------------------------------------------
      if (procedureCapabilities.hasLegacyTrain) {
        console.warn('Using legacy LP workflow');

        await session.run(`CALL gds.graph.project($graphName, $nodes, $rels)`, { graphName, nodes: NODE_PROJECTION, rels: REL_PROJECTION });

        // Node2Vec embedding (write mode)
        await session.run(
          `CALL gds.node2vec.write($graphName, { writeProperty: 'n2v', embeddingDimension: 64 })`,
          { graphName }
        );

        // Helper to train with whichever legacy procedure exists
        const trainLegacy = async () => {
          const procedures = [
            'gds.linkprediction.train',
            'gds.alpha.linkprediction.train'
          ];
          for (const proc of procedures) {
            if (procedureCapabilities.availableProcedures.includes(proc)) {
              try {
                await session.run(
                  `CALL ${proc}($graphName, {
                    nodeEmbeddingProperty: 'n2v',
                    modelName: $modelName,
                    trainFraction: 0.7
                  })`,
                  { graphName, modelName }
                );
                return proc;
              } catch (err) {
                if (!err.message.includes('not found')) throw err; // real error
              }
            }
          }
          throw new Error('No legacy linkprediction.train procedure available');
        };

        const usedTrainProc = await trainLegacy();

        // Choose matching predict proc based on train
        const predictProc = usedTrainProc.replace('.train', '.predict.stream');

        const legacyRes = await session.run(
          `CALL ${predictProc}($graphName, {
            modelName: $modelName,
            topN: $topN,
            threshold: $threshold
          }) YIELD sourceNodeId, targetNodeId, probability
          RETURN sourceNodeId, targetNodeId, probability
          ORDER BY probability DESC`,
          {
            graphName,
            modelName,
            topN: neo4j.int(topN),
            threshold
          }
        );

        const predictions = legacyRes.records.map((r) => ({
          source: toJs(r.get('sourceNodeId')),
          target: toJs(r.get('targetNodeId')),
          probability: r.get('probability')
        }));

        timerEnd();
        return { predictions };
      } else {
        throw new Error('No suitable link prediction procedures available. Modern pipeline and legacy procedures both unavailable.');
      }
    } catch (error) {
      timerEnd();
      console.error('[Hidden Links] Prediction failed:', error);
      throw error;
    } finally {
      // Clean up the unique graph/pipeline/model after processing
      try {
        await session.run(`CALL gds.graph.drop($graphName, false)`, { graphName }).catch(() => {});
        await session.run(`CALL gds.beta.pipeline.drop($pipelineName, false)`, { pipelineName }).catch(() => {});
        await session.run(`CALL gds.beta.model.drop($modelName, false)`, { modelName }).catch(() => {});
      } catch (cleanupErr) {
        console.warn('[Hidden Links] Final cleanup warning:', cleanupErr.message);
      }
      await session.close();
    }
  }

  async getCentrality(type = 'degree', limit = 20) {
    const session = this.getSession();
    const graphName = 'explorerGraph';

    try {
      // Ensure the graph is projected into the GDS catalog
      await session.run(`CALL gds.graph.drop($graphName, false)`, { graphName }).catch(() => {});
      await session.run(`CALL gds.graph.project($graphName, '*', '*')`, { graphName });

      let query;
      switch (type) {
        case 'pagerank':
          query = `
            CALL gds.pageRank.stream($graphName)
            YIELD nodeId, score
            WITH gds.util.asNode(nodeId) AS n, score AS centrality
            RETURN n, centrality
            ORDER BY centrality DESC
            LIMIT $limit
          `;
          break;
        case 'betweenness':
          query = `
            CALL gds.betweenness.stream($graphName)
            YIELD nodeId, score
            WITH gds.util.asNode(nodeId) AS n, score AS centrality
            RETURN n, centrality
            ORDER BY centrality DESC
            LIMIT $limit
          `;
          break;
        case 'degree':
        default:
          query = `
            CALL gds.degree.stream($graphName)
            YIELD nodeId, score
            WITH gds.util.asNode(nodeId) AS n, score as centrality
            RETURN n, centrality
            ORDER BY centrality DESC
            LIMIT $limit
          `;
          break;
      }

      const result = await session.run(query, { graphName, limit });
      
      const nodes = result.records.map(record => {
        const node = record.get('n');
        const centralityValue = record.get('centrality');
        const centrality = typeof centralityValue === 'number' ? centralityValue : centralityValue.toNumber();
        const props = node.properties;
        const label = node.labels[0];
        
        return {
          id: node.identity.toString(),
          label: props.name || props.test_case_id || 'Unnamed',
          title: `${label}: ${props.name || props.test_case_id || 'Unnamed'}\nCentrality: ${centrality.toFixed(3)}`,
          group: label,
          properties: props,
          centrality,
          size: Math.max(30, 30 + (centrality * 5))
        };
      });

      return { nodes, edges: [] };
    } finally {
      await session.close();
    }
  }
}

module.exports = GraphRepository; 