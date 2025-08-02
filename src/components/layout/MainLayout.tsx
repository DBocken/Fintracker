import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <div className={cn(
        "bg-sidebar-background text-sidebar-foreground transition-all duration-200 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && (
              <span className="font-semibold text-lg">FinTrack</span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
          
          <nav className="flex-1 py-4">
            {['Dashboard', 'CashFlow', 'Transactions', 'Settings'].map((item, index) => (
              <a
                key={index}
                href="#"
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  index === 0 && "bg-sidebar-primary text-sidebar-primary-foreground"
                )}
              >
                <span className={cn(!sidebarCollapsed && "mr-3")}>📊</span>
                {!sidebarCollapsed && <span>{item}</span>}
              </a>
            ))}
          </nav>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-md hover:bg-accent">🔔</button>
              <button className="p-2 rounded-md hover:bg-accent">⚙️</button>
              <button className="p-2 rounded-md hover:bg-accent">👤</button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};