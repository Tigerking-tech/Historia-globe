import { MainNav } from "@/components/navigation/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-none">
        <MainNav />
      </div>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
} 