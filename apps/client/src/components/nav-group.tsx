import { Link } from "react-router";
import { motion, LayoutGroup } from "motion/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";

export function NavGroup({ label, items }: SidebarNavGroup) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        <LayoutGroup>
          {items.map((item) =>
            item.subItems?.length ? (
              <Collapsible
                className="group/collapsible"
                defaultOpen={
                  !!item.isActive ||
                  item.subItems.some((i) => !!i.isActive)
                }
                key={item.title}
                render={<SidebarMenuItem />}
              >
                <CollapsibleTrigger
                  render={<SidebarMenuButton isActive={item.isActive} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={subItem.isActive}
                          render={<Link to={subItem.path!} />}
                        >
                          {subItem.icon}
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={item.isActive}
                  render={<Link to={item.path!} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  {item.isActive && (
                    <motion.div
                      layoutId="sidebar-nav-active"
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                    />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ),
          )}
        </LayoutGroup>
      </SidebarMenu>
    </SidebarGroup>
  );
}
