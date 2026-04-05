"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetDomainsTable } from "@/components/projects/asset-domains-table"
import { AssetHostsTable } from "@/components/projects/asset-hosts-table"
import { AssetWebTable } from "@/components/projects/asset-web-table"
import type { Asset } from "@/lib/generated/prisma"

type Props = {
  projectId: string
  assets: Asset[]
}

export function AssetPageTabs({ projectId, assets }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams?.get("tab") ?? "domains"

  // Split assets by kind
  const domains = assets.filter((a) => a.kind === "domain" || a.kind === "subdomain")
  const hosts = assets.filter((a) => a.kind === "ip" || a.kind === "port" || a.kind === "service")
  const web = assets.filter((a) => a.kind === "webapp" || a.kind === "api_endpoint")

  // Build IP value -> assetId lookup for domain table links
  const ipLookup = new Map<string, string>()
  for (const a of assets) {
    if (a.kind === "ip") ipLookup.set(a.value, a.id)
  }

  function handleTabChange(value: string) {
    router.replace(`/projects/${projectId}/assets?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="domains">域名 ({domains.length})</TabsTrigger>
        <TabsTrigger value="hosts">主机与端口 ({hosts.length})</TabsTrigger>
        <TabsTrigger value="web">Web 与 API ({web.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="domains">
        <AssetDomainsTable projectId={projectId} assets={domains} ipLookup={ipLookup} />
      </TabsContent>
      <TabsContent value="hosts">
        <AssetHostsTable projectId={projectId} assets={hosts} />
      </TabsContent>
      <TabsContent value="web">
        <AssetWebTable assets={web} portAssets={assets.filter((a) => a.kind === "port")} />
      </TabsContent>
    </Tabs>
  )
}
