import { PersonalSidebar } from "@/components/personal/personal-sidebar";

export default function PersonalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-8 flex min-h-[calc(100vh-3.5rem)]">
      <PersonalSidebar />
      <div className="flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
