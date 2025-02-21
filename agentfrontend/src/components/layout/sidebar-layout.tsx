import React from "react";
import Footer from "../footer";
import { Navbar } from "@/components/header";
import { SidebarInset } from "@/components/ui/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <Navbar />
        <main className="flex-1 p-6">{children}</main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default SidebarLayout;
