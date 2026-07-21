import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
	return (
		<div
			role="status"
			aria-label="Dashboard loading"
			className="flex flex-1 flex-col gap-4"
		>
			<span className="sr-only">Loading dashboard…</span>
			<div
				className={cn(
					"grid grid-cols-1 gap-px lg:grid-cols-3",
					"*:min-h-48 *:w-full *:bg-muted *:dark:bg-muted/50"
				)}
			>
				<div className="rounded-md" />
				<div className="rounded-md" />
				<div className="rounded-md" />
				<div className="rounded-md lg:col-span-3" />
				<div className="rounded-md lg:col-span-3" />
			</div>
		</div>
	);
}
