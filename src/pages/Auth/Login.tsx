import React from 'react';

const Login: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
          智能代码理解系统
        </h2>
        <form className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <input
              type="email"
              required
              className="relative block w-full rounded-md border-0 py-1.5 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="邮箱地址"
            />
            <input
              type="password"
              required
              className="relative block w-full rounded-md border-0 py-1.5 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="密码"
            />
          </div>
          <button
            type="submit"
            className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
