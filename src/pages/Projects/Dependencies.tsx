import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

interface Node {
  id: string;
  name: string;
  type: string;
  packageName?: string;
  role?: string;
  fqn?: string;
  count?: number;
}

interface Link {
  source: string;
  target: string;
  type: string;
  count?: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

const Dependencies: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'package' | 'layer' | 'class'>('package');
  const [packageDepth, setPackageDepth] = useState(3);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const fetchDependencies = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/projects/${id}/dependencies`, {
          params: { _t: Date.now() }
        });
        if (response.data?.success) {
          const data = response.data.data;
          if (data && typeof data === 'object' && Array.isArray(data.nodes) && Array.isArray(data.links)) {
            setGraphData({ nodes: data.nodes, links: data.links });
          } else {
            setGraphData({ nodes: [], links: [] });
          }
        } else {
          setError(response.data?.error || 'Failed to load dependencies');
        }
      } catch (error) {
        setError(error?.response?.data?.error || error?.message || 'Failed to load dependencies');
      } finally {
        setLoading(false);
      }
    };

    fetchDependencies();
  }, [id, pollAttempt]);

  useEffect(() => {
    if (!id) return;
    if (loading) return;
    if (error) return;
    if (graphData.links.length > 0) return;
    if (pollAttempt >= 10) return;
    const t = window.setTimeout(() => setPollAttempt((n) => n + 1), 1200);
    return () => window.clearTimeout(t);
  }, [id, loading, error, graphData.links.length, pollAttempt]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (viewMode !== 'class') setRoleFilter('');
    if (viewMode !== 'class') setSelectedPackage('');
  }, [viewMode]);

  const normalizePackage = (pkg?: string) => {
    if (!pkg) return '';
    return pkg.replace(/\./g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  };

  const packageKeyOfNode = (node: Node) => {
    if (node.type === 'external') return 'external';
    const pkg = normalizePackage(node.packageName);
    if (!pkg) return '(root)';
    const parts = pkg.split('/').filter(Boolean);
    if (parts.length === 0) return '(root)';
    const d = Math.max(1, Math.min(packageDepth, parts.length));
    return parts.slice(0, d).join('/');
  };

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of graphData.nodes) m.set(n.id, n);
    return m;
  }, [graphData.nodes]);

  const availableRoles = useMemo(() => {
    const s = new Set<string>();
    for (const n of graphData.nodes) {
      if (n.type === 'class' && n.role) s.add(n.role);
    }
    return Array.from(s).sort();
  }, [graphData.nodes]);

  const buildSubgraphByPackage = (pkgKey: string): GraphData => {
    if (!pkgKey) return graphData;
    const target = pkgKey === '(root)' ? '' : pkgKey;
    const keep = new Set<string>();

    for (const n of graphData.nodes) {
      if (n.type === 'external') continue;
      const pk = normalizePackage(n.packageName);
      if (target === '') {
        if (!pk) keep.add(n.id);
      } else if (pk === target || pk.startsWith(target + '/')) {
        keep.add(n.id);
      }
    }

    for (const l of graphData.links) {
      const s = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const t = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      if (!s || !t) continue;
      if (keep.has(s) || keep.has(t)) {
        keep.add(s);
        keep.add(t);
      }
    }

    const nodes = graphData.nodes.filter((n) => keep.has(n.id));
    const keep2 = new Set(nodes.map((n) => n.id));
    const links = graphData.links.filter((l) => {
      const s = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const t = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      return Boolean(s && t && keep2.has(s) && keep2.has(t));
    });
    return { nodes, links };
  };

  const classViewGraph = useMemo(() => {
    const base = selectedPackage ? buildSubgraphByPackage(selectedPackage) : graphData;
    if (!roleFilter) return base;

    const keep = new Set<string>();
    for (const n of base.nodes) {
      if (n.type === 'class' && n.role === roleFilter) keep.add(n.id);
    }
    for (const l of base.links) {
      const s = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const t = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      if (!s || !t) continue;
      if (keep.has(s) || keep.has(t)) {
        keep.add(s);
        keep.add(t);
      }
    }
    const nodes = base.nodes.filter((n) => keep.has(n.id));
    const keep2 = new Set(nodes.map((n) => n.id));
    const links = base.links.filter((l) => {
      const s = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const t = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      return Boolean(s && t && keep2.has(s) && keep2.has(t));
    });
    return { nodes, links };
  }, [graphData, roleFilter, selectedPackage]);

  const packageViewGraph = useMemo((): GraphData => {
    const pkgNodes = new Map<string, Node>();
    const linkCount = new Map<string, number>();
    const pkgId = (k: string) => `pkg:${k}`;

    const ensurePkg = (k: string) => {
      if (pkgNodes.has(k)) return;
      pkgNodes.set(k, { id: pkgId(k), name: k, type: 'package', packageName: k, count: 0 });
    };

    for (const n of graphData.nodes) {
      const k = packageKeyOfNode(n);
      ensurePkg(k);
      const pn = pkgNodes.get(k)!;
      pn.count = (pn.count || 0) + 1;
    }

    for (const l of graphData.links) {
      if (l.type === 'contains') continue;
      if (edgeTypeFilter && l.type !== edgeTypeFilter) continue;
      const sId = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const tId = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      if (!sId || !tId) continue;
      const sNode = nodeById.get(sId);
      const tNode = nodeById.get(tId);
      if (!sNode || !tNode) continue;
      const sp = packageKeyOfNode(sNode);
      const tp = packageKeyOfNode(tNode);
      if (!sp || !tp || sp === tp) continue;
      ensurePkg(sp);
      ensurePkg(tp);
      const key = `${sp}=>${tp}`;
      linkCount.set(key, (linkCount.get(key) || 0) + 1);
    }

    const nodes = Array.from(pkgNodes.values());
    const links: Link[] = [];
    for (const [k, c] of linkCount.entries()) {
      const [sp, tp] = k.split('=>');
      links.push({ source: pkgId(sp), target: pkgId(tp), type: 'depends', count: c });
    }

    return { nodes, links };
  }, [graphData, nodeById, packageDepth, edgeTypeFilter]);

  const layerViewGraph = useMemo((): GraphData => {
    const roleOfClassId = (id: string) => {
      const n = nodeById.get(id);
      if (n && n.type === 'class') return n.role || 'other';
      return null;
    };

    const fileRole = new Map<string, string>();
    for (const l of graphData.links) {
      if (l.type !== 'contains') continue;
      const s = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const t = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      if (!s || !t) continue;
      const sn = nodeById.get(s);
      const tn = nodeById.get(t);
      if (!sn || !tn) continue;
      if (sn.type !== 'file' || tn.type !== 'class') continue;
      const r = tn.role || 'other';
      const prev = fileRole.get(s);
      if (!prev) {
        fileRole.set(s, r);
      } else if (prev !== r) {
        fileRole.set(s, prev);
      }
    }

    const groupOf = (nodeId: string) => {
      const n = nodeById.get(nodeId);
      if (!n) return null;
      if (n.type === 'external') return 'external';
      if (n.type === 'class') return n.role || 'other';
      if (n.type === 'file') return fileRole.get(nodeId) || 'other';
      if (n.type === 'function') {
        const idStr = String(n.id || '');
        if (idStr.startsWith('java:') && idStr.includes('#')) {
          const owner = idStr.split('#')[0];
          const role = roleOfClassId(owner);
          if (role) return role;
        }
        return 'other';
      }
      return 'other';
    };

    const groupCount = new Map<string, number>();
    for (const n of graphData.nodes) {
      if (n.type !== 'class') continue;
      const g = n.role || 'other';
      groupCount.set(g, (groupCount.get(g) || 0) + 1);
    }
    if (graphData.nodes.some((n) => n.type === 'external')) groupCount.set('external', 1);

    const linkCount = new Map<string, number>();
    for (const l of graphData.links) {
      if (l.type === 'contains') continue;
      if (edgeTypeFilter && l.type !== edgeTypeFilter) continue;
      const sId = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
      const tId = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
      if (!sId || !tId) continue;
      const sg = groupOf(sId);
      const tg = groupOf(tId);
      if (!sg || !tg || sg === tg) continue;
      const key = `${sg}=>${tg}`;
      linkCount.set(key, (linkCount.get(key) || 0) + 1);
    }

    const nodes: Node[] = [];
    const links: Link[] = [];
    const idOf = (g: string) => `layer:${g}`;

    for (const [g, c] of groupCount.entries()) {
      nodes.push({ id: idOf(g), name: g, type: 'layer', role: g === 'external' ? undefined : g, count: c });
    }

    for (const [k, c] of linkCount.entries()) {
      const [sg, tg] = k.split('=>');
      links.push({ source: idOf(sg), target: idOf(tg), type: 'depends', count: c });
    }

    return { nodes, links };
  }, [graphData, nodeById, edgeTypeFilter]);

  const roleColor = (role?: string) => {
    if (!role) return null;
    if (role === 'controller') return '#B91C1C';
    if (role === 'service') return '#1E3A8A';
    if (role === 'serviceImpl') return '#1D4ED8';
    if (role === 'repository') return '#0F766E';
    if (role === 'mapper') return '#0F766E';
    if (role === 'entity') return '#059669';
    if (role === 'dto') return '#7C3AED';
    if (role === 'config') return '#B45309';
    if (role === 'util') return '#334155';
    if (role === 'component') return '#4338CA';
    return '#111827';
  };

  const packageColor = (pkgKey?: string) => {
    const last = String(pkgKey || '').split('/').filter(Boolean).slice(-1)[0] || '';
    const s = last.toLowerCase();
    if (s === 'controller' || s === 'web') return '#B91C1C';
    if (s === 'service' || s === 'impl') return '#1E3A8A';
    if (s === 'mapper' || s === 'dao' || s === 'repository') return '#0F766E';
    if (s === 'entity' || s === 'model' || s === 'domain') return '#059669';
    if (s === 'dto' || s === 'vo') return '#7C3AED';
    if (s === 'config') return '#B45309';
    if (s === 'util' || s === 'common') return '#334155';
    if (pkgKey === 'external') return '#6B7280';
    if (pkgKey === '(root)') return '#0EA5E9';
    return '#0EA5E9';
  };

  const showGraph = viewMode === 'package' ? packageViewGraph : viewMode === 'layer' ? layerViewGraph : classViewGraph;
  const renderGraph = useMemo(() => {
    if (viewMode !== 'class' || !edgeTypeFilter) return showGraph;
    const links = showGraph.links.filter((l) => l.type === 'contains' || l.type === edgeTypeFilter);
    return { nodes: showGraph.nodes, links };
  }, [showGraph, viewMode, edgeTypeFilter]);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading dependencies...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <h1 className="text-xl font-bold">Dependency Graph</h1>
        <div className="flex items-center gap-3">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="px-3 py-2 border rounded-lg bg-white text-sm"
          >
            <option value="package">Package View</option>
            <option value="layer">Layer View</option>
            <option value="class">Class View</option>
          </select>

          <select
            value={edgeTypeFilter}
            onChange={(e) => setEdgeTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white text-sm"
          >
            <option value="">All Edges</option>
            <option value="injects">injects</option>
            <option value="import">import</option>
            <option value="implements">implements</option>
            <option value="extends">extends</option>
          </select>

          <button
            onClick={() => {
              setEdgeTypeFilter('injects');
              setViewMode('layer');
            }}
            className="px-3 py-2 border rounded-lg bg-white text-sm hover:bg-gray-50"
          >
            Injects Chain
          </button>

          {viewMode === 'package' ? (
            <select
              value={packageDepth}
              onChange={(e) => setPackageDepth(parseInt(e.target.value, 10))}
              className="px-3 py-2 border rounded-lg bg-white text-sm"
            >
              <option value={1}>Depth 1</option>
              <option value={2}>Depth 2</option>
              <option value={3}>Depth 3</option>
              <option value={4}>Depth 4</option>
              <option value={5}>Depth 5</option>
            </select>
          ) : viewMode === 'class' ? (
            <>
              {selectedPackage && (
                <button
                  onClick={() => setSelectedPackage('')}
                  className="px-3 py-2 border rounded-lg bg-white text-sm hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white text-sm"
              >
                <option value="">All Roles</option>
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Click a layer to drill down
            </div>
          )}
          <div className="space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            File
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Class
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Function
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            External
          </span>
          </div>
        </div>
      </div>
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <div ref={containerRef} className="flex-grow bg-gray-50 overflow-hidden">
        <ForceGraph2D
          graphData={{
            nodes: renderGraph.nodes.map(n => ({ ...n })),
            links: renderGraph.links.map(l => ({ ...l }))
          }}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel={(node: any) => {
            if (node.type === 'package') {
              const label = node.packageName || node.name;
              const c = typeof node.count === 'number' ? node.count : undefined;
              return c !== undefined ? `${label} (${c})` : label;
            }
            if (node.type === 'layer') {
              const label = node.name || node.role || 'layer';
              const c = typeof node.count === 'number' ? node.count : undefined;
              return c !== undefined ? `${label} (${c})` : label;
            }
            const title = node.fqn || (node.packageName ? `${node.packageName}.${node.name}` : node.name);
            return node.role ? `${node.role}: ${title}` : title;
          }}
          nodeColor={(node: any) => {
            if (node.type === 'package') return packageColor(node.packageName)
            if (node.type === 'layer') return node.role ? (roleColor(node.role) || '#111827') : '#6B7280'
            if (node.type === 'class') return roleColor(node.role) || '#1E3A8A'
            if (node.type === 'function') return '#6D28D9'
            if (node.type === 'file') return '#059669'
            return '#9CA3AF'
          }}
          linkWidth={(link: any) => {
            if (viewMode === 'class') return 1;
            const c = typeof link.count === 'number' ? link.count : 1;
            return Math.min(10, 1 + Math.log10(c + 1) * 4);
          }}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(node: any) => {
            if (viewMode === 'package' && node.type === 'package') {
              if (node.packageName === 'external') return;
              setSelectedPackage(node.packageName || '');
              setViewMode('class');
              return;
            }
            if (viewMode === 'layer' && node.type === 'layer') {
              if (!node.role) return;
              setRoleFilter(node.role);
              setViewMode('class');
              return;
            }
          }}
        />
      </div>
    </div>
  );
};

export default Dependencies;
