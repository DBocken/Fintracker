import React from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp, 
  FileText, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: TrendingUp, label: 'CashFlow' },
  { icon: FileText, label: 'Transactions' },
  { icon: Settings, label: 'Settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <div className={cn(
      "bg-sidebar-background text-sidebar-foreground transition-all duration-200 ease-in-out",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!collapsed && (
            <span className="font-semibold text-lg">FinTrack</span>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 py-4">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                item.active && "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <item.icon size={20} className={cn(!collapsed && "mr-3")} />
              {!collapsed && <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
};