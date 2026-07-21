import { Link, useLocation } from "react-router";
import { LogoIcon } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import { navGroups, footerNavLinks, computeActiveFlags } from "@/components/app-shared";

export function AppSidebar() {
  const { pathname } = useLocation();
  const activeGroups = computeActiveFlags(pathname, navGroups);

  return (
    <Sidebar collapsible="icon" variant="inset" role="complementary" aria-label="Sidebar">
      <SidebarHeader className="h-14 justify-center">
        <SidebarMenuButton render={<Link to="/" />}>
          <LogoIcon />
          <span className="font-medium">Meridian</span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent role="navigation" aria-label="Main navigation">
        {activeGroups.map((group, index) => (
          <NavGroup key={`sidebar-group-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="mt-2">
          {footerNavLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className="text-muted-foreground"
                isActive={item.path === pathname}
                size="sm"
                render={<Link to={item.path!} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
