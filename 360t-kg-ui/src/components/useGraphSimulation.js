import { useEffect, useState } from 'react';
import * as d3 from 'd3';

export function useGraphSimulation({
  data,
  svgRef,
  getNodeColor,
  getNodeSize,
  getNodeShape,
  getRelationshipColor,
  getRelationshipDashArray,
  onNodeSelect,
}) {
  const [simulation, setSimulation] = useState(null);

  useEffect(() => {
    let sim = null;

    try {
      if (!data || !data.nodes || !data.links || data.nodes.length === 0) return;
      if (!svgRef.current) return;

      d3.select(svgRef.current).selectAll("*").remove();

      const width = svgRef.current.clientWidth || 800;
      const height = svgRef.current.clientHeight || 600;

      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
        }));

      const g = svg.append("g");

      sim = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links)
          .id(d => d.id)
          .distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => {
          const nodeType = d.labels ? d.labels[0] : 'Default';
          const size = getNodeSize(d) || 20;
          return size + 10;
        }));

      const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("class", "graph-link")
        .attr("stroke", d => getRelationshipColor(d))
        .attr("stroke-dasharray", d => {
          const dash = getRelationshipDashArray(d);
          return dash ? dash : null;
        })
        .attr("stroke-width", 1.5);

      const linkText = g.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("class", "link-label")
        .attr("font-size", "8px")
        .text(d => d.type || d.label || "");

      const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(data.nodes)
        .enter().append("g")
        .attr("class", "node-group")
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
        .on("click", (event, d) => {
          event.stopPropagation();
          onNodeSelect(d);
        });

      node.append("path")
        .attr("d", d => {
          try {
            const symbolType = getNodeShape(d);
            const size = getNodeSize(d) || 20;
            return d3.symbol().type(symbolType).size(Math.PI * size * size * 2)();
          } catch {
            return d3.symbol().type(d3.symbolCircle).size(400)();
          }
        })
        .attr("fill", d => getNodeColor(d))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      node.append("rect")
        .attr("class", "node-label-bg")
        .attr("y", 20)
        .attr("x", -40)
        .attr("width", 80)
        .attr("height", 15)
        .attr("fill", "#e5e5e5")
        .attr("opacity", 0.6)
        .attr("rx", 3)
        .attr("ry", 3);

      node.append("text")
        .attr("dy", 30)
        .attr("text-anchor", "middle")
        .attr("class", "node-label")
        .text(d => {
          if (d.properties && d.properties.name) return d.properties.name;
          if (d.properties && d.properties.test_case_id) return d.properties.test_case_id;
          if (d.name) return d.name;
          return d.id;
        })
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("stroke", "white")
        .attr("stroke-width", "0.3px")
        .attr("fill", "#000");

      function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      sim.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        linkText
          .attr("x", d => (d.source.x + d.target.x) / 2)
          .attr("y", d => (d.source.y + d.target.y) / 2);

        node
          .attr("transform", d => `translate(${d.x}, ${d.y})`);
      });

      setSimulation(sim);
    } catch (err) {
      console.error('useGraphSimulation error:', err);
    }

    return () => {
      if (sim) sim.stop();
      if (svgRef.current) d3.select(svgRef.current).selectAll("*").remove();
    };
  }, [data, svgRef, getNodeColor, getNodeSize, getNodeShape, getRelationshipColor, getRelationshipDashArray, onNodeSelect]);

  return simulation;
}
