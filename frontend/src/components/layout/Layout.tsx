import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Menu } from 'lucide-react';
import ModernHeader from './ModernHeader';
import Sidebar from './Sidebar';
import { Button } from '../ui';

export interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  className,
  showSidebar = true 
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <ModernHeader />
      
      <div className="flex-1 flex overflow-hidden">
        {showSidebar && (
          <>
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden fixed top-4 left-4 z-40 h-8 w-8 p-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            
            <Sidebar 
              isOpen={sidebarOpen} 
              onClose={() => setSidebarOpen(false)} 
            />
          </>
        )}
        
        {/* Main content */}
        <main className={clsx(
          'flex-1 overflow-auto',
          showSidebar && 'lg:ml-0',
          className
        )}>
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;