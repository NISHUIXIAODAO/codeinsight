package com.codeinsight.api.dto;

import java.util.List;

public class GraphData {
    private List<GraphNode> nodes;
    private List<GraphLink> links;

    public GraphData() {
    }

    public GraphData(List<GraphNode> nodes, List<GraphLink> links) {
        this.nodes = nodes;
        this.links = links;
    }

    public List<GraphNode> getNodes() {
        return nodes;
    }

    public void setNodes(List<GraphNode> nodes) {
        this.nodes = nodes;
    }

    public List<GraphLink> getLinks() {
        return links;
    }

    public void setLinks(List<GraphLink> links) {
        this.links = links;
    }
}
