import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogOut, BookOpen, PenTool } from 'lucide-react';

export default function Layout() {
  const { user, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-8">
      <header className="w-full flex justify-between items-center mb-12 border-b border-ink/10 pb-4">
        <Link to="/" className="text-2xl font-bold tracking-widest uppercase">
          The Midnight Post
        </Link>
        <nav className="flex gap-6 items-center text-sm tracking-widest uppercase">
          {user ? (
            <>
              <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                <PenTool size={16} /> Desk
              </Link>
              <Link to="/archive" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                <BookOpen size={16} /> Archive
              </Link>
              <button onClick={signOut} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <button onClick={signIn} className="hover:opacity-70 transition-opacity">
              Login
            </button>
          )}
        </nav>
      </header>

      <main className="flex-1 w-full flex flex-col items-center justify-center">
        <Outlet />
      </main>

      <footer className="w-full text-center mt-12 pt-4 border-t border-ink/10 text-xs opacity-50 uppercase tracking-widest">
        &copy; {new Date().getFullYear()} The Midnight Post. All rights reserved.
      </footer>
    </div>
  );
}
