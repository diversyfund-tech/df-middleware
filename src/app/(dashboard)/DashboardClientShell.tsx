"use client";

import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { MenuSidebar } from "./components/MenuSidebar";

export default function DashboardClientShell({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<MenuSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
					</div>
				</header>
				<main className="px-4 max-md:w-screen">{children}</main>
				<footer className="py-8">
					<p className="text-center text-sm text-muted-foreground">
						&copy; {new Date().getFullYear()} DF-Middleware - All rights
						reserved.
					</p>
				</footer>
			</SidebarInset>
		</SidebarProvider>
	);
}
