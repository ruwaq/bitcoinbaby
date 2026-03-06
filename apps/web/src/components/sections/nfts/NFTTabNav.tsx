"use client";

import { TabButton } from "@bitcoinbaby/ui";

export type SubTab =
  | "explorer"
  | "collection"
  | "mint"
  | "claim"
  | "marketplace";

interface NFTTabNavProps {
  activeTab: SubTab;
  explorerCount: number;
  collectionCount: number;
  marketplaceCount: number;
  onTabChange: (tab: SubTab) => void;
  onMintTabClick: () => void;
  onClaimTabClick: () => void;
}

export function NFTTabNav({
  activeTab,
  explorerCount,
  collectionCount,
  marketplaceCount,
  onTabChange,
  onMintTabClick,
  onClaimTabClick,
}: NFTTabNavProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <TabButton
        active={activeTab === "explorer"}
        onClick={() => onTabChange("explorer")}
        variant="secondary"
      >
        Explorer ({explorerCount})
      </TabButton>
      <TabButton
        active={activeTab === "collection"}
        onClick={() => onTabChange("collection")}
        variant="primary"
      >
        My NFTs ({collectionCount})
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
        For Sale ({marketplaceCount})
      </TabButton>
    </div>
  );
}
