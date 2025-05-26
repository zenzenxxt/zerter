
// Removed AppHeader import and usage as individual dashboard layouts will handle their own headers or no header.
// The RootLayout (src/app/layout.tsx) might still use AppHeader for non-dashboard pages.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This (app)/layout.tsx's div should be a flex container that allows its child (the specific dashboard layout)
    // to grow and fill the available space. It no longer needs min-h-screen if dashboards use SidebarProvider.
    <div className="flex flex-1 flex-col"> {/* Ensures it takes up available space and acts as a flex container */}
        {children}
    </div>
  );
}
