import * as React from "react";
import { Bot, Coins, MessageCircle } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useRouter } from "next/router";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useRouter();

  console.log(pathname);

  const navMain = [
    {
      title: "Setup",
      url: "/setup",
      icon: Bot,
      isActive: pathname === "/setup",
    },
    {
      title: "Transfer Tokens",
      url: "/transfer",
      icon: Coins,
      isActive: pathname === "/transfer",
    },
    {
      title: "Chat",
      url: "/chat",
      icon: MessageCircle,
      isActive: pathname === "/chat",
    },
  ];

  return (
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenuButton
          asChild
          className="text-xl font-bold items-center justify-center flex"
          tooltip="Home"
        >
          <Link href="/">
            <div>L</div>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter></SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
