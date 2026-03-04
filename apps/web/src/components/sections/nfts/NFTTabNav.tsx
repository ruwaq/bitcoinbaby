"use client";

import { TabButton } from "@bitcoinbaby/ui";

type SubTab = "collection" | "mint" | "claim" | "marketplace";

interface NFTTabNavProps {
  activeTab: SubTab;
  collectionCount: number;
  marketplaceCount: number;
  onTabChange: (tab: SubTab) => void;
  onMintTabClick: () => void;
  onClaimTabClick: () => void;
}

export function NFTTabNav({
  activeTab,
  collectionCount,
  marketplaceCount,
  onTabChange,
  onMintTabClick,
  onClaimTabClick,
}: NFTTabNavProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <TabButton
        active={activeTab === "collection"}
        onClick={() => onTabChange("collection")}
        variant="primary"
      >
        My Collection ({collectionCount})
      </TabButton>
      <TabButton
        active={activeTab === "mint"}
        onClick={onMintTabClick}
        variant="success"
      >
        Mint New
      </TabButton>
      <TabButton
        active={activeTab === "claim"}
        onClick={onClaimTabClick}
        variant="secondary"
      >
        Claim NFT
      </TabButton>
      <TabButton
        active={activeTab === "marketplace"}
        onClick={() => onTabChange("marketplace")}
        variant="warning"
      >
        Marketplace ({marketplaceCount})
      </TabButton>
    </div>
  );
}
