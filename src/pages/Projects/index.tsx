import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderCode, Plus, Search, X } from 'lucide-react';
import axios from 'axios';

interface Project {
  id: string;
  name: string;
  url: string | null;
  language: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importLanguage, setImportLanguage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/projects');
        if (res.data?.success) {
          setProjects(res.data.data ?? []);
        } else {
          setError(res.data?.error || 'Failed to load projects');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const hay = `${p.name} ${p.url ?? ''} ${p.language ?? ''} ${p.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  const refresh = async () => {
    setError(null);
    try {
      const res = await axios.get('/api/projects');
      if (res.data?.success) {
        setProjects(res.data.data ?? []);
      } else {
        setError(res.data?.error || 'Failed to load projects');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load projects');
    }
  };

  const submitImport = async () => {
    if (submitting) return;
    if (!importName.trim()) {
      setError('Project name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post('/api/projects/import', {
        name: importName.trim(),
        url: importUrl.trim() || null,
        path: importPath.trim() || null,
        language: importLanguage.trim() || null,
      });
      if (res.data?.success) {
        setShowImport(false);
        setImportName('');
        setImportUrl('');
        setImportPath('');
        setImportLanguage('');
        await refresh();
      } else {
        setError(res.data?.error || 'Import failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500">Manage and analyze your code repositories</p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Import Project
        </button>
      </div>

      <div className="flex items-center space-x-4 bg-white p-4 rounded-xl border">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <div key={project.id} className="bg-white p-6 rounded-xl border hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <FolderCode className="w-6 h-6 text-blue-600" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                project.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {project.status}
              </span>
            </div>
            <h3 className="text-lg font-bold mb-1">{project.name}</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{project.url || '—'}</p>
            <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
              <span>{project.language || '—'}</span>
              <span>
                Updated {new Date(project.updated_at || project.created_at || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <div className="flex space-x-2">
              <Link
                to={`/projects/${project.id}/dependencies`}
                className="flex-grow text-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Graph
              </Link>
              <Link
                to={`/projects/${project.id}/copilot`}
                className="flex-grow text-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Copilot
              </Link>
            </div>
          </div>
        ))}
      </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg border shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-bold text-gray-900">Import Project</div>
              <button
                onClick={() => setShowImport(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Name</div>
                <input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Repository"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Git URL (optional)</div>
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://github.com/user/repo"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Local Path (optional)</div>
                <input
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="E:\\path\\to\\repo"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Language (optional)</div>
                <input
                  value={importLanguage}
                  onChange={(e) => setImportLanguage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Java / Python / TypeScript"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitImport}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
