import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="overflow-hidden">
			<a
				href="#main-content"
				className="fixed -top-40 left-2 z-[100] rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all focus:top-2 focus-visible:outline-none"
			>
				Skip to content
			</a>
			<SidebarProvider className="relative h-svh">
				<AppSidebar />
				<SidebarInset className="md:peer-data-[variant=inset]:ml-0">
					<AppHeader />
					<main
						id="main-content"
						className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6"
						tabIndex={-1}
					>
						{children}
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
