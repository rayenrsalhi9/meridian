export const DASHBOARD_LOCALE = "en-US";

/** Noon anchor avoids off-by-one labels around timezone boundaries for ISO date strings. */
export function parseIsoCalendarDate(isoDate: string): Date {
	return new Date(`${isoDate}T12:00:00`);
}

export type DashboardDateStyle = "month" | "day-month" | "full";

export function formatDate(isoDate: string, style: DashboardDateStyle): string {
	const date = parseIsoCalendarDate(isoDate);
	if (style === "month") {
		return date.toLocaleDateString(DASHBOARD_LOCALE, { month: "short" });
	}
	if (style === "day-month") {
		return date.toLocaleDateString(DASHBOARD_LOCALE, {
			day: "numeric",
			month: "short",
		});
	}
	return date.toLocaleDateString(DASHBOARD_LOCALE, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/** X-axis for range charts: weekday when showing ~a week, otherwise month + day. */
export function formatChartAxisTick(
	isoDate: string,
	periodDays: number
): string {
	const date = parseIsoCalendarDate(isoDate);
	if (periodDays <= 7) {
		return date.toLocaleDateString(DASHBOARD_LOCALE, { weekday: "short" });
	}
	return formatDate(isoDate, "day-month");
}
