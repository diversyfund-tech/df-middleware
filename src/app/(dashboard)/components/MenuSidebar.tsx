"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	IconHome,
	IconRoute,
	IconFileText,
	IconBook,
	IconSettings,
	IconMessage,
	IconMoonStars,
	IconSun,
	IconSunMoon,
} from "@tabler/icons-react";

type MenuLink = {
	title: string;
	url: string;
	segment: string | null;
	icon: React.ComponentType<{ className?: string }>;
};

const mainLinks: MenuLink[] = [
	{
		title: "Home",
		url: "/",
		segment: null,
		icon: IconHome,
	},
];

const workflowLinks: MenuLink[] = [
	{
		title: "Workflows",
		url: "/workflows",
		segment: "workflows",
		icon: IconRoute,
	},
	{
		title: "Workflow Builder",
		url: "/workflows/builder",
		segment: "builder",
		icon: IconFileText,
	},
];

const documentationLinks: MenuLink[] = [
	{
		title: "Visual Docs",
		url: "/docs/visual",
		segment: "visual",
		icon: IconFileText,
	},
	{
		title: "Knowledge Base",
		url: "/docs/knowledge-base",
		segment: "knowledge-base",
		icon: IconBook,
	},
];

const adminLinks: MenuLink[] = [
	{
		title: "Agents",
		url: "/admin/agents",
		segment: "agents",
		icon: IconSettings,
	},
];

const toolsLinks: MenuLink[] = [
	{
		title: "Chat",
		url: "/chat",
		segment: "chat",
		icon: IconMessage,
	},
];

export function MenuSidebar() {
	const { theme, setTheme } = useTheme();
	const segment = useSelectedLayoutSegment();
	const pathname = usePathname();
	const sidebar = useSidebar();

	useEffect(() => {
		sidebar.setOpenMobile(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader>
				<div className="px-2 pt-2">
					<Link href="/" className="flex items-center gap-2">
						<Image
							src="/images/dfos_logo_light-theme.png"
							alt="DF-OS Logo"
							width={120}
							height={40}
							className="dark:hidden"
							priority
						/>
						<Image
							src="/images/dfos_logo_dark-theme.png"
							alt="DF-OS Logo"
							width={120}
							height={40}
							className="hidden dark:block"
							priority
						/>
					</Link>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Main</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainLinks.map((item, idx) => {
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={idx}>
										<SidebarMenuButton
											asChild
											isActive={segment === item.segment}
										>
											<Link href={item.url}>
												<Icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Workflows</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{workflowLinks.map((item, idx) => {
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={idx}>
										<SidebarMenuButton
											asChild
											isActive={
												segment === item.segment ||
												(pathname.startsWith(item.url) &&
													item.segment !== null)
											}
										>
											<Link href={item.url}>
												<Icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Documentation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{documentationLinks.map((item, idx) => {
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={idx}>
										<SidebarMenuButton
											asChild
											isActive={
												segment === item.segment ||
												(pathname.startsWith(item.url) &&
													item.segment !== null)
											}
										>
											<Link href={item.url}>
												<Icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Admin</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{adminLinks.map((item, idx) => {
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={idx}>
										<SidebarMenuButton
											asChild
											isActive={
												segment === item.segment ||
												(pathname.startsWith(item.url) &&
													item.segment !== null)
											}
										>
											<Link href={item.url}>
												<Icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Tools</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{toolsLinks.map((item, idx) => {
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={idx}>
										<SidebarMenuButton
											asChild
											isActive={
												segment === item.segment ||
												(pathname.startsWith(item.url) &&
													item.segment !== null)
											}
										>
											<Link href={item.url}>
												<Icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<IconSunMoon className="size-4" />
									<span>Theme</span>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								className="w-[--radix-popper-anchor-width]"
							>
								<DropdownMenuItem
									className="cursor-pointer"
									onClick={() => setTheme("light")}
								>
									<IconSun className="mr-2 size-4" />
									<span>Light theme</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									className="cursor-pointer"
									onClick={() => setTheme("dark")}
								>
									<IconMoonStars className="mr-2 size-4" />
									<span>Dark theme</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
