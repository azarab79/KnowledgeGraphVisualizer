import React, { useState } from 'react';
import GraphView from './GraphView';
import { fetchClusters, fetchHiddenLinks } from '../services/analysisApi';
import { getInitialGraph } from '../services/api';
import '../styles/AdvancedAnalysisPanel.css';

/**
 * AdvancedAnalysisPanel – Variant 1 (Tabs & Split-Pane)
 */
const AdvancedAnalysisPanel = () => {
  const [activeTab, setActiveTab] = useState('clusters');
  const [resolution, setResolution] = useState(1.0);
  const [topN, setTopN] = useState(20);
  const [threshold, setThreshold] = useState(0.4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [customConfig, setCustomConfig] = useState(null);

  const runClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClusters({ resolution });
      // Convert backend nodes/edges to GraphView format
      const links = data.edges.map((e) => ({
        ...e,
        source: e.from,
        target: e.to,
        type: e.label,
      }));
      setGraphData({ nodes: data.nodes, links });
      setSummary({ modularity: data.modularity, communityCount: data.communityCount });
    } catch (err) {
      console.error(err);
      setError('Cluster analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const runHiddenLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch predictions & baseline graph
      const [predData, baseGraph] = await Promise.all([
        fetchHiddenLinks({ topN, threshold }),
        getInitialGraph()
      ]);

      const predictedEdges = predData.predictions.map((p, idx) => ({
        id: `pred-${idx}-${p.source}-${p.target}`,
        from: p.source.toString(),
        to: p.target.toString(),
        label: 'PREDICTED',
        type: 'PREDICTED',
        probability: p.probability,
        properties: { probability: p.probability }
      }));

      const links = [
        ...baseGraph.links,
        ...predictedEdges.map((e) => ({ ...e, source: e.from, target: e.to }))
      ];

      setGraphData({ nodes: baseGraph.nodes, links });
      setCustomConfig({ relationshipLineStyles: { PREDICTED: '4 2' } });
      setSummary({ count: predictedEdges.length });
    } catch (err) {
      console.error(err);
      setError('Hidden Links analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const renderControls = () => {
    switch (activeTab) {
      case 'clusters':
        return (
          <div className="controls">
            <label>
              Resolution: {resolution.toFixed(2)}
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={resolution}
                onChange={(e) => setResolution(parseFloat(e.target.value))}
              />
            </label>
            <button onClick={runClusters} disabled={loading}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
        );
      case 'hidden':
        return (
          <div className="controls">
            <label>
              TopN: {topN}
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value, 10))}
              />
            </label>
            <label>
              Threshold: {threshold.toFixed(2)}
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
              />
            </label>
            <button onClick={runHiddenLinks} disabled={loading}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
        );
      default:
        return <p>Coming soon…</p>;
    }
  };

  const renderResults = () => {
    if (error) return <div className="error">{error}</div>;
    if (!graphData) return <p>No results yet</p>;
    return (
      <>
        {summary && (
          <div className="summary">
            {activeTab === 'clusters' && (
              <>Modularity: {summary.modularity?.toFixed?.(3) || summary.modularity} | Communities: {summary.communityCount}</>
            )}
            {activeTab === 'hidden' && <>Predicted links: {summary.count}</>}
          </div>
        )}
        <GraphView data={graphData} customConfig={customConfig} />
      </>
    );
  };

  return (
    <div className="advanced-analysis">
      <div className="tabs">
        <button className={activeTab === 'clusters' ? 'active' : ''} onClick={() => setActiveTab('clusters')}>
          Clusters
        </button>
        <button className={activeTab === 'hidden' ? 'active' : ''} onClick={() => setActiveTab('hidden')}>
          Hidden Links
        </button>
        <button className={activeTab === 'criticality' ? 'active' : ''} onClick={() => setActiveTab('criticality')} disabled>
          Criticality
        </button>
      </div>

      <div className="split-pane">
        <div className="left-pane">{renderControls()}</div>
        <div className="right-pane">{renderResults()}</div>
      </div>
    </div>
  );
};

export default AdvancedAnalysisPanel; 