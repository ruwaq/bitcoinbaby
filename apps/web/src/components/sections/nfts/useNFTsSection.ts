import { useState, useCallback } from "react";
import { type BabyNFTState } from "@bitcoinbaby/ui";
import { type BabyNFTState as CoreBabyNFTState } from "@bitcoinbaby/bitcoin";
import { useNFTs } from "@/hooks/features";
import { useNFTExplorer } from "@/hooks/useNFTExplorer";
import type { SubTab } from "./NFTTabNav";

type MintState = "info" | "confirming" | "minting" | "revealing" | "success";

export interface ListFeedback {
  type: "success" | "error";
  message: string;
}

/**
 * useNFTsSection - Local UI state and handlers for NFTsSection
 */
export function useNFTsSection() {
  // UI state
  const [activeTab, setActiveTab] = useState<SubTab>("explorer");
  const [mintState, setMintState] = useState<MintState>("info");
  const [evolvingIds, setEvolvingIds] = useState<Set<number>>(new Set());
  const [listingIds, setListingIds] = useState<Set<number>>(new Set());
  const [claimTxid, setClaimTxid] = useState("");
  const [selectedNFT, setSelectedNFT] = useState<BabyNFTState | null>(null);
  const [listFeedback, setListFeedback] = useState<ListFeedback | null>(null);

  // Data hooks
  const nfts = useNFTs();
  const explorer = useNFTExplorer();

  // Handlers
  const handleMintClick = useCallback(() => {
    setMintState("confirming");
  }, []);

  const handleConfirmedMint = useCallback(async () => {
    setMintState("minting");
    const result = await nfts.minting.mint();

    if (result.success && result.nft) {
      setMintState("revealing");
      await new Promise((r) => setTimeout(r, 2000));
      nfts.collection.setNFTs([result.nft, ...nfts.collection.nfts]);
      nfts.collection.invalidate();
      setMintState("success");
    } else {
      setMintState("info");
    }
  }, [nfts.minting, nfts.collection]);

  const handleCancelMint = useCallback(() => {
    setMintState("info");
  }, []);

  const handleMintAnother = useCallback(() => {
    setMintState("info");
    nfts.minting.reset();
  }, [nfts.minting]);

  const handleViewCollection = useCallback(() => {
    setMintState("info");
    nfts.minting.reset();
    nfts.claiming.reset();
    setActiveTab("collection");
  }, [nfts.minting, nfts.claiming]);

  const handleClaimNFT = useCallback(async () => {
    if (!claimTxid.trim()) return;
    const result = await nfts.claiming.claim(claimTxid);
    if (result.success) {
      setClaimTxid("");
    }
  }, [claimTxid, nfts.claiming]);

  const handleSelectNFT = useCallback(
    (nft: BabyNFTState) => {
      setSelectedNFT(selectedNFT?.tokenId === nft.tokenId ? null : nft);
    },
    [selectedNFT],
  );

  const handleEvolve = useCallback(
    async (nft: BabyNFTState) => {
      // Mark as evolving
      setEvolvingIds((prev) => new Set(prev).add(nft.tokenId));

      try {
        // Cast to core type for blockchain operations
        // UI type is a superset of core type, so this is safe for canonical bloodlines
        const coreNFT = nft as unknown as CoreBabyNFTState;

        // Execute real blockchain evolution
        const result = await nfts.evolution.evolve(coreNFT);

        if (result.success && result.newLevel) {
          // Optimistically update local state while tx confirms
          const updatedNFTs = nfts.collection.nfts.map((n) =>
            n.tokenId === nft.tokenId
              ? { ...n, level: result.newLevel!, xp: 0 }
              : n,
          );
          nfts.collection.setNFTs(updatedNFTs);

          // Update selected NFT if it was the evolved one
          if (selectedNFT?.tokenId === nft.tokenId) {
            setSelectedNFT({ ...nft, level: result.newLevel, xp: 0 });
          }

          // Invalidate cache to refetch from server
          nfts.collection.invalidate();
        }
      } finally {
        // Remove from evolving set
        setEvolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(nft.tokenId);
          return next;
        });
      }
    },
    [nfts.evolution, nfts.collection, selectedNFT],
  );

  const handleListNFT = useCallback(
    async (nft: BabyNFTState, price: number) => {
      setListingIds((prev) => new Set(prev).add(nft.tokenId));
      setListFeedback(null);

      const result = await nfts.marketplace.listNFT(nft.tokenId, price);

      if (result.success) {
        setListFeedback({
          type: "success",
          message: `NFT #${nft.tokenId} listed for ${price.toLocaleString()} sats!`,
        });
        setTimeout(() => setListFeedback(null), 5000);
      } else {
        setListFeedback({
          type: "error",
          message: result.error || "Failed to list NFT",
        });
      }

      setListingIds((prev) => {
        const next = new Set(prev);
        next.delete(nft.tokenId);
        return next;
      });
    },
    [nfts.marketplace],
  );

  const handleMintTabClick = useCallback(() => {
    setActiveTab("mint");
    setMintState("info");
  }, []);

  const handleClaimTabClick = useCallback(() => {
    setActiveTab("claim");
    nfts.claiming.reset();
  }, [nfts.claiming]);

  return {
    // State
    activeTab,
    setActiveTab,
    mintState,
    evolvingIds,
    listingIds,
    claimTxid,
    setClaimTxid,
    selectedNFT,
    setSelectedNFT,
    listFeedback,
    setListFeedback,

    // Data
    ...nfts,
    explorer,
    mintAttempts: nfts.mintAttempts,

    // Handlers
    handleMintClick,
    handleConfirmedMint,
    handleCancelMint,
    handleMintAnother,
    handleViewCollection,
    handleClaimNFT,
    handleSelectNFT,
    handleEvolve,
    handleListNFT,
    handleMintTabClick,
    handleClaimTabClick,
  };
}
