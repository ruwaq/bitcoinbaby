"use client";

import { TabButton } from "@bitcoinbaby/ui";

export type SubTab = "collection" | "mint" | "explorer";

interface NFTTabNavProps {
  activeTab: SubTab;
  explorerCount: number;
  collectionCount: number;
  onTabChange: (tab: SubTab) => void;
  onMintTabClick: () => void;
}

export function NFTTabNav({
  activeTab,
  explorerCount,
  collectionCount,
  onTabChange,
  onMintTabClick,
}: NFTTabNavProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <TabButton
        active={activeTab === "collection"}
        onClick={() => onTabChange("collection")}
        variant="primary"
      >
        My Babies ({collectionCount})
      </TabButton>
      <TabButton
        active={activeTab === "mint"}
        onClick={onMintTabClick}
        variant="success"
      >
        Mint
      </TabButton>
      <TabButton
        active={activeTab === "explorer"}
        onClick={() => onTabChange("explorer")}
        variant="secondary"
      >
        Explorer ({explorerCount})
      </TabButton>
    </div>
  );
}
