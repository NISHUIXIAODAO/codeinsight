import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderCode, PlayCircle, User, Settings, LogOut } from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { name: '仪表盘', path: '/dashboard', icon: LayoutDashboard },
    { name: '项目管理', path: '/projects', icon: FolderCode },
    { name: '任务调度', path: '/tasks', icon: PlayCircle },
    { name: '个人中心', path: '/profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 bg-white">
        <div className="flex h-16 items-center px-6 border-b border-zinc-200">
          <span className="text-xl font-bold text-blue-600">CodeInsight</span>
        </div>
        <nav className="mt-6 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-64 border-t border-zinc-200 p-4">
          <button className="flex w-full items-center px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <LogOut className="mr-3 h-5 w-5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-800">
            {navItems.find((n) => n.path === location.pathname)?.name || '概览'}
          </h1>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-zinc-400 hover:text-zinc-600">
              <Settings className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              U
            </div>
          </div>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
