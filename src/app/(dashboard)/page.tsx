import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";

export default function Home() {
	return (
		<div className="container mx-auto py-8 max-w-6xl">
			{/* Header */}
			<div className="mb-12 text-center">
				<h1 className="text-5xl font-bold mb-4 text-foreground">
					DF Middleware
				</h1>
				<p className="text-xl text-muted-foreground">
					Centralized data synchronization between Aloware, GHL, and Verity
				</p>
			</div>

			{/* System Overview */}
			<div className="grid md:grid-cols-3 gap-6 mb-12">
				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="text-sm font-medium">Aloware</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-4">
							Call center platform integration
						</p>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-500 rounded-full"></div>
							<span className="text-sm text-muted-foreground">Connected</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="text-sm font-medium">GHL</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-4">
							CRM and contact management
						</p>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-500 rounded-full"></div>
							<span className="text-sm text-muted-foreground">Connected</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-1">
						<CardTitle className="text-sm font-medium">Verity</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-4">
							Texting and messaging platform
						</p>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-500 rounded-full"></div>
							<span className="text-sm text-muted-foreground">Connected</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Features */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>Features</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid md:grid-cols-2 gap-6">
						<div>
							<h3 className="font-semibold mb-2 text-foreground">
								Async Event Processing
							</h3>
							<p className="text-sm text-muted-foreground">
								Webhook events are processed asynchronously with automatic retries and error handling
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-foreground">
								Bidirectional Sync
							</h3>
							<p className="text-sm text-muted-foreground">
								Contacts sync between Aloware and GHL with conflict resolution
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-foreground">
								Texting Integration
							</h3>
							<p className="text-sm text-muted-foreground">
								SMS/MMS messages sync to GHL with opt-out compliance handling
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-foreground">
								Admin APIs
							</h3>
							<p className="text-sm text-muted-foreground">
								Replay, quarantine, and manage events through admin endpoints
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* API Endpoints */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>API Endpoints</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="border-l-4 border-primary pl-4">
							<h3 className="font-mono text-sm font-semibold mb-1 text-foreground">
								POST /api/webhooks/aloware
							</h3>
							<p className="text-sm text-muted-foreground">
								Aloware webhook handler
							</p>
						</div>
						<div className="border-l-4 border-primary pl-4">
							<h3 className="font-mono text-sm font-semibold mb-1 text-foreground">
								POST /api/webhooks/ghl
							</h3>
							<p className="text-sm text-muted-foreground">
								GHL webhook handler
							</p>
						</div>
						<div className="border-l-4 border-primary pl-4">
							<h3 className="font-mono text-sm font-semibold mb-1 text-foreground">
								POST /api/webhooks/texting
							</h3>
							<p className="text-sm text-muted-foreground">
								Verity texting webhook handler
							</p>
						</div>
						<div className="border-l-4 border-green-500 pl-4">
							<h3 className="font-mono text-sm font-semibold mb-1 text-foreground">
								GET /api/health
							</h3>
							<p className="text-sm text-muted-foreground">
								Health check endpoint
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* MCP Chat Link */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>MCP Chat Interface</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-6">
						Chat with AI to execute Verity API endpoints through the MCP server
					</p>
					<Link href="/chat">
						<Button>Open Chat Interface →</Button>
					</Link>
				</CardContent>
			</Card>

			{/* Workflows */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>Workflow Builder</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-6">
						Design workflows for ElevenLabs voice agents through conversational AI
					</p>
					<div className="flex gap-4">
						<Link href="/workflows">
							<Button>Manage Workflows →</Button>
						</Link>
						<Link href="/workflows/builder">
							<Button variant="outline">Create New →</Button>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* Visual Documentation */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>Visual Documentation</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-6">
						Visual guides and system documentation for non-technical staff
					</p>
					<Link href="/docs/visual">
						<Button>Open Visual Guide →</Button>
					</Link>
				</CardContent>
			</Card>

			{/* Knowledge Base */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>Knowledge Base</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-6">
						Written guides explaining DF-Middleware in plain language for non-technical staff
					</p>
					<Link href="/docs/knowledge-base">
						<Button>Open Knowledge Base →</Button>
					</Link>
				</CardContent>
			</Card>

			{/* Admin Links */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle>Admin Tools</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid md:grid-cols-2 gap-4">
						<Link href="/admin/agents">
							<Card className="hover:bg-accent transition-colors cursor-pointer">
								<CardHeader>
									<CardTitle className="text-lg">Agent Directory</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										View and manage AI calling agents
									</p>
								</CardContent>
							</Card>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* Footer */}
			<div className="mt-12 text-center text-sm text-muted-foreground">
				<p>
					For documentation and setup instructions, see the{" "}
					<Link
						href="https://github.com/diversyfund-tech/df-middleware"
						className="text-primary hover:underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub repository
					</Link>
					.
				</p>
			</div>
		</div>
	);
}
